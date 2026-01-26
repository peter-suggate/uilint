/**
 * SearchInput - Elegant search bar for command palette
 *
 * Features Spotlight/Raycast-inspired design:
 * - Larger, more prominent input
 * - Subtle focus animations
 * - Animated clear button
 * - macOS-style keyboard hint
 */
import React, { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SearchIcon, CloseIcon } from "../../icons";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search commands, issues, rules...",
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-focus on mount with slight delay for animation
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: 0.05 }}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "14px 16px",
        gap: 12,
        borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
        background: isFocused
          ? "rgba(255, 255, 255, 0.6)"
          : "rgba(255, 255, 255, 0.4)",
        transition: "background 0.15s ease",
      }}
    >
      {/* Search icon with subtle animation */}
      <motion.div
        animate={{
          scale: isFocused ? 1.05 : 1,
          color: isFocused ? "#3b82f6" : "#9ca3af",
        }}
        transition={{ duration: 0.15 }}
        style={{ display: "flex", alignItems: "center" }}
      >
        <SearchIcon size={20} />
      </motion.div>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        style={{
          flex: 1,
          border: "none",
          outline: "none",
          fontSize: 15,
          fontWeight: 400,
          background: "transparent",
          color: "#111827",
          caretColor: "#3b82f6",
        }}
      />

      {/* Clear button with enter/exit animation */}
      <AnimatePresence mode="wait">
        {value ? (
          <motion.button
            key="clear"
            initial={{ opacity: 0, scale: 0.8, rotate: -90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.8, rotate: 90 }}
            transition={{ duration: 0.15 }}
            onClick={() => onChange("")}
            style={{
              border: "none",
              background: "rgba(0, 0, 0, 0.05)",
              borderRadius: 6,
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6b7280",
            }}
            whileHover={{ background: "rgba(0, 0, 0, 0.1)" }}
            whileTap={{ scale: 0.9 }}
          >
            <CloseIcon size={14} />
          </motion.button>
        ) : (
          <motion.div
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Kbd>esc</Kbd>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>to close</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Kbd - macOS-style keyboard hint
 */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 20,
        height: 18,
        padding: "0 5px",
        fontSize: 10,
        fontWeight: 500,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
        color: "#6b7280",
        background: "linear-gradient(180deg, #ffffff 0%, #f3f4f6 100%)",
        border: "1px solid rgba(0, 0, 0, 0.1)",
        borderRadius: 4,
        boxShadow: "0 1px 0 rgba(0, 0, 0, 0.08)",
        textTransform: "lowercase",
      }}
    >
      {children}
    </span>
  );
}

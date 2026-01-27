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
import { Kbd, IconButton } from "../primitives";

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
      transition={{ duration: 0.1 }}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "14px 16px",
        gap: 12,
        borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
        background: isFocused
          ? "rgba(255, 255, 255, 0.6)"
          : "rgba(255, 255, 255, 0.4)",
        transition: "background 0.1s ease",
      }}
    >
      {/* Search icon with subtle animation */}
      <motion.div
        animate={{
          color: isFocused ? "var(--uilint-accent)" : "var(--uilint-text-disabled)",
        }}
        transition={{ duration: 0.1 }}
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
          color: "var(--uilint-text-primary)",
          caretColor: "var(--uilint-accent)",
        }}
      />

      {/* Clear button with enter/exit animation */}
      <AnimatePresence mode="wait">
        {value ? (
          <motion.div
            key="clear"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.1 }}
          >
            <IconButton
              variant="ghost"
              size="sm"
              onClick={() => onChange("")}
              disableMotion
            >
              <CloseIcon size={14} />
            </IconButton>
          </motion.div>
        ) : (
          <motion.div
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Kbd animate={false}>esc</Kbd>
            <span style={{ fontSize: 11, color: "var(--uilint-text-disabled)" }}>to close</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

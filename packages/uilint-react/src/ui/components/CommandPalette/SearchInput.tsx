/**
 * SearchInput - Hero search bar for command palette
 *
 * Spotlight/Raycast-inspired design:
 * - Large, prominent input (48px height)
 * - Subtle focus glow
 * - Glassmorphic background
 * - Minimal color - monochrome with single accent
 * - shadcn class conventions
 */

import * as React from "react";
import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { SearchIcon, CloseIcon } from "../../icons";
import { Kbd, IconButton } from "../primitives";
import { cn } from "../../../lib/utils";
import { useComposedStore } from "../../../core/store";

// ============================================================================
// Variants
// ============================================================================

const searchContainerVariants = cva(
  "flex items-center gap-3 border-b transition-all duration-150",
  {
    variants: {
      size: {
        default: "px-4 py-3",
        large: "px-5 py-4",
      },
      state: {
        default: "bg-transparent border-border/30",
        focused: "bg-muted/30 border-border/50",
      },
    },
    defaultVariants: {
      size: "large",
      state: "default",
    },
  }
);

const searchInputVariants = cva(
  "flex-1 bg-transparent border-none outline-none font-normal tracking-tight",
  {
    variants: {
      size: {
        default: "text-base h-8",
        large: "text-lg h-10",
      },
    },
    defaultVariants: {
      size: "large",
    },
  }
);

// ============================================================================
// Animation variants
// ============================================================================

const iconMotionVariants = {
  default: { scale: 1, opacity: 0.4 },
  focused: { scale: 1.05, opacity: 0.7 },
};

const clearButtonMotionVariants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 },
};

const hintMotionVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// Crisp easing
const crispEase = [0.32, 0.72, 0, 1] as const;

// ============================================================================
// Types
// ============================================================================

export interface SearchInputProps extends VariantProps<typeof searchContainerVariants> {
  /** Current search value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Auto focus on mount */
  autoFocus?: boolean;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * SearchInput - Hero search bar component
 *
 * @example
 * ```tsx
 * <SearchInput
 *   value={query}
 *   onChange={setQuery}
 *   placeholder="Search commands, issues, rules..."
 * />
 * ```
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search commands, issues, rules...",
  autoFocus = true,
  size,
  className,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const isMobile = useComposedStore((s) => s.mobile.isMobile);

  // Auto-focus on mount with slight delay for animation
  useEffect(() => {
    if (!autoFocus) return;

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  const state = isFocused ? "focused" : "default";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.1 }}
      className={cn(searchContainerVariants({ size, state }), className)}
      style={{
        // Subtle glow on focus
        boxShadow: isFocused
          ? "0 1px 0 0 var(--uilint-border), inset 0 1px 0 0 rgba(255,255,255,0.02)"
          : "none",
      }}
    >
      {/* Search icon */}
      <motion.div
        variants={iconMotionVariants}
        animate={state}
        transition={{ duration: 0.15, ease: crispEase }}
        className="flex items-center justify-center shrink-0"
        style={{ color: "var(--uilint-text-muted)" }}
      >
        <SearchIcon size={size === "large" ? 22 : 18} />
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
        className={cn(searchInputVariants({ size }))}
        style={{
          color: "var(--uilint-text-primary)",
          caretColor: "var(--uilint-accent)",
        }}
      />

      {/* Clear button / Keyboard hint (desktop only) */}
      <AnimatePresence mode="wait">
        {value ? (
          <motion.div
            key="clear"
            variants={clearButtonMotionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.1, ease: crispEase }}
          >
            <IconButton
              variant="ghost"
              size="sm"
              onClick={() => onChange("")}
              disableMotion
              style={{
                color: "var(--uilint-text-muted)",
                opacity: 0.6,
              }}
            >
              <CloseIcon size={14} />
            </IconButton>
          </motion.div>
        ) : !isMobile ? (
          <motion.div
            key="hint"
            variants={hintMotionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.1, ease: crispEase }}
            className="flex items-center gap-2 shrink-0"
          >
            <Kbd animate={false}>esc</Kbd>
            <span
              className="text-[11px]"
              style={{ color: "var(--uilint-text-disabled)" }}
            >
              to close
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

export { searchContainerVariants, searchInputVariants };

/**
 * SearchInput - Hero search bar for command palette
 *
 * Spotlight/Raycast-inspired design:
 * - Large, prominent input (48px height)
 * - Subtle focus glow
 * - Glassmorphic background
 * - Minimal color - monochrome with single accent
 * - shadcn class conventions
 * - Inline filter chips with flex-wrap
 */

import * as React from "react";
import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { SearchIcon, CloseIcon } from "../../icons";
import { Kbd, IconButton } from "../primitives";
import { cn } from "../../../lib/utils";
import { useComposedStore } from "../../../core/store";
import { FilterChip } from "./FilterChip";
import type { TileFilter } from "../../../core/plugin-system/types";

// ============================================================================
// Variants
// ============================================================================

const searchContainerVariants = cva(
  "flex items-center gap-4 border-b transition-all duration-150",
  {
    variants: {
      size: {
        default: "px-5 py-4",
        large: "px-6 py-5",
      },
      state: {
        default: "bg-transparent border-foreground/[0.06]",
        focused: "bg-foreground/[0.02] border-foreground/[0.08]",
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
  default: { scale: 1, opacity: 0.35 },
  focused: { scale: 1, opacity: 0.5 },
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
  /** Active filters to display as chips */
  filters?: TileFilter[];
  /** Callback when a filter chip is removed */
  onRemoveFilter?: (index: number) => void;
  /** Callback when backspace is pressed with empty input */
  onRemoveLastFilter?: () => void;
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
  filters = [],
  onRemoveFilter,
  onRemoveLastFilter,
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

  // Handle backspace on empty input to remove last filter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && value === "" && filters.length > 0 && onRemoveLastFilter) {
      e.preventDefault();
      onRemoveLastFilter();
    }
  };

  const state = isFocused ? "focused" : "default";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.1 }}
      className={cn(searchContainerVariants({ size, state }), className)}
      style={{
        // Minimal styling - no extra visual noise
        boxShadow: "none",
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

      {/* Filter chips and input container - allows chips to wrap */}
      <div className="flex-1 flex flex-wrap items-center gap-2 min-w-0">
        {/* Filter chips */}
        <AnimatePresence mode="popLayout">
          {filters.map((filter, index) => (
            <FilterChip
              key={`${filter.type}-${filter.id}`}
              filter={filter}
              onRemove={() => onRemoveFilter?.(index)}
            />
          ))}
        </AnimatePresence>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={filters.length > 0 ? "Add more filters..." : placeholder}
          className={cn(searchInputVariants({ size }), "min-w-[120px]")}
          style={{
            color: "var(--uilint-text-primary)",
            caretColor: "var(--uilint-accent)",
          }}
        />
      </div>

      {/* Clear button / Keyboard hint (desktop only) */}
      <AnimatePresence mode="wait">
        {value || filters.length > 0 ? (
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
              onClick={() => {
                onChange("");
                // Also clear all filters if there are any
                if (filters.length > 0 && onRemoveFilter) {
                  for (let i = filters.length - 1; i >= 0; i--) {
                    onRemoveFilter(i);
                  }
                }
              }}
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

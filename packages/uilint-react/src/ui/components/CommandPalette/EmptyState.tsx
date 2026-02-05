/**
 * EmptyState - Minimal empty state component for the CommandPalette
 *
 * Displays elegant illustrations and messaging when there are no tiles to show.
 * Uses lucide icons for clean, consistent visuals.
 */
import React from "react";
import { motion } from "motion/react";
import { Search, CheckCircle, Filter, X } from "lucide-react";

interface EmptyStateProps {
  variant: "no-results" | "no-issues" | "filtered-empty";
  query?: string;
  onClearFilters?: () => void;
}

// Crisp easing curve matching the design system
const crispEase = [0.32, 0.72, 0, 1] as const;

/**
 * NoResultsIllustration - Clean search icon with lucide
 */
function NoResultsIllustration() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: crispEase }}
      className="mb-6 opacity-30"
    >
      <Search size={36} strokeWidth={1.5} />
    </motion.div>
  );
}

/**
 * NoIssuesIllustration - Clean checkmark icon with lucide
 */
function NoIssuesIllustration() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: crispEase }}
      className="mb-6 text-success opacity-50"
    >
      <CheckCircle size={36} strokeWidth={1.5} />
    </motion.div>
  );
}

/**
 * FilteredEmptyIllustration - Clean filter icon with lucide
 */
function FilteredEmptyIllustration() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: crispEase }}
      className="relative mb-6 opacity-30"
    >
      <Filter size={36} strokeWidth={1.5} />
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.2, ease: crispEase }}
        className="absolute -bottom-1 -right-1 bg-surface rounded-full p-0.5"
      >
        <X size={14} strokeWidth={2} />
      </motion.div>
    </motion.div>
  );
}

/**
 * ClearFiltersButton - Minimal styled button for clearing filters
 */
function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.15, ease: crispEase }}
      className="mt-5 py-2.5 px-5 text-[13px] font-medium text-text-secondary bg-transparent hover:bg-foreground/[0.08] border border-foreground/15 rounded-[10px] cursor-pointer transition-colors outline-none"
    >
      Clear filters
    </motion.button>
  );
}

/**
 * EmptyState - Main component
 */
export function EmptyState({ variant, onClearFilters }: EmptyStateProps) {
  const content = React.useMemo(() => {
    switch (variant) {
      case "no-results":
        return {
          illustration: <NoResultsIllustration />,
          title: "No matches found",
          subtitle: "Try different keywords",
        };
      case "no-issues":
        return {
          illustration: <NoIssuesIllustration />,
          title: "Looking good!",
          subtitle: "No issues detected",
        };
      case "filtered-empty":
        return {
          illustration: <FilteredEmptyIllustration />,
          title: "No items match current filters",
          subtitle: null,
        };
    }
  }, [variant]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: crispEase }}
      className="flex flex-col items-center justify-center py-14 px-8 text-center min-h-[220px]"
    >
      {content.illustration}

      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.2, ease: crispEase }}
        className="m-0 text-sm font-medium text-text-secondary tracking-tight"
      >
        {content.title}
      </motion.h3>

      {content.subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.2, ease: crispEase }}
          className="mt-2 mb-0 text-[13px] text-text-muted opacity-70 leading-normal"
        >
          {content.subtitle}
        </motion.p>
      )}

      {variant === "filtered-empty" && onClearFilters && (
        <ClearFiltersButton onClick={onClearFilters} />
      )}
    </motion.div>
  );
}

export default EmptyState;

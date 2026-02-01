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
      style={{
        marginBottom: 24,
        opacity: 0.3,
      }}
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
      style={{
        marginBottom: 24,
        color: "var(--uilint-success)",
        opacity: 0.5,
      }}
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
      style={{
        position: "relative",
        marginBottom: 24,
        opacity: 0.3,
      }}
    >
      <Filter size={36} strokeWidth={1.5} />
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.2, ease: crispEase }}
        style={{
          position: "absolute",
          bottom: -4,
          right: -4,
          background: "var(--uilint-surface, #fff)",
          borderRadius: "50%",
          padding: 2,
        }}
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
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.15, ease: crispEase }}
      style={{
        marginTop: 20,
        padding: "10px 20px",
        fontSize: 13,
        fontWeight: 450,
        color: "var(--uilint-text-secondary)",
        background: isHovered
          ? "rgba(128, 128, 128, 0.08)"
          : "transparent",
        border: "1px solid rgba(128, 128, 128, 0.15)",
        borderRadius: 10,
        cursor: "pointer",
        transition: "background 0.15s ease, border-color 0.15s ease",
        outline: "none",
      }}
    >
      Clear filters
    </motion.button>
  );
}

/**
 * EmptyState - Main component
 */
export function EmptyState({ variant, query, onClearFilters }: EmptyStateProps) {
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
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "56px 32px",
        textAlign: "center",
        minHeight: 220,
      }}
    >
      {content.illustration}

      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.2, ease: crispEase }}
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 500,
          color: "var(--uilint-text-secondary)",
          letterSpacing: "-0.01em",
        }}
      >
        {content.title}
      </motion.h3>

      {content.subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.2, ease: crispEase }}
          style={{
            margin: "8px 0 0 0",
            fontSize: 13,
            color: "var(--uilint-text-muted)",
            opacity: 0.7,
            lineHeight: 1.5,
          }}
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

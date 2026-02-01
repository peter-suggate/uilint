/**
 * EmptyState - Beautiful empty state component for the CommandPalette
 *
 * Displays elegant illustrations and messaging when there are no tiles to show.
 * Uses pure CSS shapes for illustrations (no emoji or icon fonts).
 */
import React from "react";
import { motion } from "motion/react";

interface EmptyStateProps {
  variant: "no-results" | "no-issues" | "filtered-empty";
  query?: string;
  onClearFilters?: () => void;
}

// Crisp easing curve matching the design system
const crispEase = [0.32, 0.72, 0, 1] as const;

/**
 * NoResultsIllustration - Subtle search icon made of CSS shapes
 */
function NoResultsIllustration() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: crispEase }}
      style={{
        position: "relative",
        width: 64,
        height: 64,
        marginBottom: 20,
      }}
    >
      {/* Magnifying glass circle */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        style={{
          position: "absolute",
          top: 4,
          left: 4,
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "2.5px solid var(--uilint-text-disabled)",
          background: "transparent",
        }}
      />
      {/* Handle of magnifying glass */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.2, duration: 0.25, ease: crispEase }}
        style={{
          position: "absolute",
          top: 38,
          left: 34,
          width: 20,
          height: 2.5,
          background: "var(--uilint-text-disabled)",
          borderRadius: 2,
          transform: "rotate(45deg)",
          transformOrigin: "left center",
        }}
      />
      {/* Decorative dots - scattered around */}
      {[
        { top: 0, right: 8, size: 4, delay: 0.3 },
        { top: 12, right: 2, size: 3, delay: 0.35 },
        { bottom: 12, left: 0, size: 3, delay: 0.4 },
      ].map((dot, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.4, scale: 1 }}
          transition={{ delay: dot.delay, duration: 0.2 }}
          style={{
            position: "absolute",
            top: dot.top,
            right: dot.right,
            bottom: dot.bottom,
            left: dot.left,
            width: dot.size,
            height: dot.size,
            borderRadius: "50%",
            background: "var(--uilint-text-muted)",
          }}
        />
      ))}
    </motion.div>
  );
}

/**
 * NoIssuesIllustration - Celebratory checkmark with concentric circles
 */
function NoIssuesIllustration() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: crispEase }}
      style={{
        position: "relative",
        width: 72,
        height: 72,
        marginBottom: 20,
      }}
    >
      {/* Outer ring */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.15 }}
        transition={{ delay: 0.1, duration: 0.4, ease: crispEase }}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "1.5px solid var(--uilint-success)",
        }}
      />
      {/* Middle ring */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.3 }}
        transition={{ delay: 0.15, duration: 0.35, ease: crispEase }}
        style={{
          position: "absolute",
          inset: 8,
          borderRadius: "50%",
          border: "1.5px solid var(--uilint-success)",
        }}
      />
      {/* Inner filled circle */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3, ease: crispEase }}
        style={{
          position: "absolute",
          inset: 18,
          borderRadius: "50%",
          background: "var(--uilint-success-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Checkmark using CSS */}
        <motion.div
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.25 }}
          style={{
            position: "relative",
            width: 16,
            height: 16,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            style={{ width: "100%", height: "100%" }}
          >
            <motion.path
              d="M5 13l4 4L19 7"
              stroke="var(--uilint-success)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.4, duration: 0.3, ease: crispEase }}
            />
          </svg>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/**
 * FilteredEmptyIllustration - Simple filter/funnel shape
 */
function FilteredEmptyIllustration() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: crispEase }}
      style={{
        position: "relative",
        width: 56,
        height: 56,
        marginBottom: 20,
      }}
    >
      {/* Filter/funnel shape using stacked lines */}
      {[
        { width: 48, top: 8 },
        { width: 36, top: 20 },
        { width: 24, top: 32 },
        { width: 8, top: 44 },
      ].map((line, i) => (
        <motion.div
          key={i}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 0.6 - i * 0.1 }}
          transition={{ delay: 0.1 + i * 0.05, duration: 0.25, ease: crispEase }}
          style={{
            position: "absolute",
            top: line.top,
            left: "50%",
            transform: "translateX(-50%)",
            width: line.width,
            height: 3,
            borderRadius: 2,
            background: "var(--uilint-text-disabled)",
          }}
        />
      ))}
      {/* X mark overlay */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ delay: 0.3, duration: 0.25, ease: crispEase }}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 20,
            height: 20,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 20,
              height: 2,
              background: "var(--uilint-text-muted)",
              borderRadius: 1,
              transform: "translate(-50%, -50%) rotate(45deg)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 20,
              height: 2,
              background: "var(--uilint-text-muted)",
              borderRadius: 1,
              transform: "translate(-50%, -50%) rotate(-45deg)",
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * ClearFiltersButton - Styled button for clearing filters
 */
function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isPressed, setIsPressed] = React.useState(false);

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15, ease: crispEase }}
      style={{
        marginTop: 16,
        padding: "8px 16px",
        fontSize: 13,
        fontWeight: 500,
        color: "var(--uilint-accent)",
        background: isHovered
          ? "var(--uilint-hover)"
          : "transparent",
        border: "1px solid var(--uilint-border)",
        borderRadius: "var(--uilint-radius-sm, 8px)",
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
        padding: "48px 24px",
        textAlign: "center",
        minHeight: 200,
      }}
    >
      {content.illustration}

      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.25, ease: crispEase }}
        style={{
          margin: 0,
          fontSize: 15,
          fontWeight: 600,
          color: "var(--uilint-text-primary)",
          letterSpacing: "-0.01em",
        }}
      >
        {content.title}
      </motion.h3>

      {content.subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.25, ease: crispEase }}
          style={{
            margin: "6px 0 0 0",
            fontSize: 13,
            color: "var(--uilint-text-muted)",
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

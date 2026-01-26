/**
 * AnimatedListItem - Wrapper for list items with elegant staggered animations
 *
 * Provides Spotlight/Raycast-style entry animations with:
 * - Staggered delays based on index
 * - Smooth spring physics
 * - Subtle slide + fade effect
 */
import React from "react";
import { motion } from "motion/react";

interface AnimatedListItemProps {
  children: React.ReactNode;
  index: number;
  /** Optional key for AnimatePresence tracking */
  layoutId?: string;
  /** Max delay cap to prevent slow renders on long lists */
  maxDelay?: number;
  /** Base delay between items */
  staggerDelay?: number;
}

// Spring configuration for natural motion
const springConfig = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
  mass: 0.8,
};

export function AnimatedListItem({
  children,
  index,
  layoutId,
  maxDelay = 0.15,
  staggerDelay = 0.025,
}: AnimatedListItemProps) {
  // Calculate delay with cap for performance
  const delay = Math.min(index * staggerDelay, maxDelay);

  return (
    <motion.div
      layoutId={layoutId}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{
        ...springConfig,
        delay,
        opacity: { duration: 0.15, delay },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * AnimatedSection - Wrapper for section headers with slide-in animation
 */
export function AnimatedSection({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.25,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * SelectionIndicator - Animated selection background
 *
 * Provides a smooth morphing selection indicator like Raycast
 */
export function SelectionIndicator({
  isSelected,
  children,
  variant = "default",
}: {
  isSelected: boolean;
  children: React.ReactNode;
  variant?: "default" | "command" | "issue";
}) {
  const bgStyles = {
    default: {
      selected: "linear-gradient(90deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.04) 100%)",
      unselected: "transparent",
    },
    command: {
      selected: "linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.06) 100%)",
      unselected: "transparent",
    },
    issue: {
      selected: "linear-gradient(90deg, rgba(239, 68, 68, 0.06) 0%, transparent 100%)",
      unselected: "transparent",
    },
  };

  const styles = bgStyles[variant];

  return (
    <motion.div
      animate={{
        background: isSelected ? styles.selected : styles.unselected,
        borderLeftColor: isSelected ? "#3b82f6" : "transparent",
      }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      style={{
        borderLeft: "2px solid transparent",
        position: "relative",
      }}
    >
      {children}
      {/* Subtle glow effect when selected */}
      {isSelected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at left center, rgba(59, 130, 246, 0.08) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
      )}
    </motion.div>
  );
}

/**
 * AnimatedListItem - Wrapper for list items with elegant staggered animations
 *
 * Provides Spotlight/Raycast-style entry animations with:
 * - Staggered delays based on index
 * - Crisp easing curves
 * - Subtle slide + fade effect
 */
import React from "react";
import { motion } from "motion/react";
import { useScrollTarget } from "./useScrollSelectedIntoView";

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

// Crisp easing curve
const crispEase = [0.32, 0.72, 0, 1];

export function AnimatedListItem({
  children,
  index,
  layoutId,
  maxDelay = 0.12,
  staggerDelay = 0.02,
}: AnimatedListItemProps) {
  // Calculate delay with cap for performance
  const delay = Math.min(index * staggerDelay, maxDelay);

  return (
    <motion.div
      layoutId={layoutId}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{
        duration: 0.12,
        ease: crispEase,
        delay,
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
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.12,
        delay,
        ease: crispEase,
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
  resultIndex,
}: {
  isSelected: boolean;
  children: React.ReactNode;
  variant?: "default" | "command" | "issue";
  resultIndex?: number;
}) {
  // Always call the hook (Rules of Hooks) — uses -1 as no-op sentinel
  const scrollRef = useScrollTarget(resultIndex ?? -1);
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
      ref={resultIndex != null ? scrollRef : undefined}
      animate={{
        background: isSelected ? styles.selected : styles.unselected,
        borderLeftColor: isSelected ? "#3b82f6" : "transparent",
      }}
      transition={{ duration: 0.1, ease: crispEase }}
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
          transition={{ duration: 0.1 }}
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

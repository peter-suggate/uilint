/**
 * Expansion Animation System
 *
 * Centralized animation definitions for the expandable tile UI.
 * Uses motion/react (Framer Motion) for smooth, coordinated animations.
 */

import type { Transition, Variants } from "motion/react";

// ============================================================================
// Shared Easing Curves
// ============================================================================

/**
 * Crisp easing curve - snappy, responsive feel.
 * Used throughout the command palette for consistency.
 */
export const crispEase = [0.32, 0.72, 0, 1] as const;

/**
 * Smooth overshoot easing - gentle bounce at the end.
 * Used for expansion animations to feel more organic.
 */
export const smoothOvershoot = [0.16, 1, 0.3, 1] as const;

/**
 * Quick ease-in - for elements exiting.
 */
export const quickEaseIn = [0.4, 0, 1, 1] as const;

// ============================================================================
// Duration Constants
// ============================================================================

export const DURATIONS = {
  /** Quick micro-interactions (hover, tap) */
  micro: 0.15,
  /** Standard transitions */
  standard: 0.2,
  /** Expansion/collapse of tiles */
  expand: 0.3,
  /** Stagger delay between children */
  staggerChild: 0.04,
  /** Delay before children start animating */
  childrenDelay: 0.15,
  /** Quick exit for collapsing elements */
  quickExit: 0.15,
} as const;

// ============================================================================
// Tile State Variants
// ============================================================================

/**
 * Variants for the main tile container.
 * Handles transitions between normal, expanded, and collapsed-sibling states.
 */
export const tileContainerVariants: Variants = {
  // Standard tile in the grid
  normal: {
    scale: 1,
    opacity: 1,
  },

  // Expanded tile (showing children)
  expanded: {
    scale: 1,
    opacity: 1,
  },

  // Sibling of an expanded tile (minimal view in collapsed strip)
  collapsedSibling: {
    scale: 0.95,
    opacity: 0.8,
  },

  // Exit animation
  exit: {
    scale: 0.95,
    opacity: 0,
  },
};

/**
 * Transition for tile container state changes.
 */
export const tileContainerTransition: Transition = {
  duration: DURATIONS.expand,
  ease: crispEase,
};

// ============================================================================
// Expansion Animation Variants
// ============================================================================

/**
 * Variants for the expanded tile wrapper.
 * Animates the expansion from tile size to full width.
 */
export const expansionWrapperVariants: Variants = {
  collapsed: {
    opacity: 0,
    scale: 0.95,
  },
  expanded: {
    opacity: 1,
    scale: 1,
  },
};

/**
 * Transition for expansion wrapper.
 */
export const expansionWrapperTransition: Transition = {
  duration: DURATIONS.expand,
  ease: crispEase,
};

// ============================================================================
// Children Stagger Variants
// ============================================================================

/**
 * Parent variants for staggered children animation.
 * Apply to the container that holds child tiles.
 */
export const childrenContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: DURATIONS.staggerChild,
      delayChildren: DURATIONS.childrenDelay,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1,
    },
  },
};

/**
 * Individual child tile animation variants.
 */
export const childTileVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 12,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
  },
};

/**
 * Transition for individual child tiles.
 */
export const childTileTransition: Transition = {
  duration: DURATIONS.standard,
  ease: crispEase,
};

// ============================================================================
// Collapsed Strip Variants
// ============================================================================

/**
 * Variants for the collapsed sibling strip.
 * Animates the strip sliding in/out.
 */
export const collapsedStripVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -8,
    height: 0,
  },
  visible: {
    opacity: 1,
    y: 0,
    height: "auto",
  },
  exit: {
    opacity: 0,
    y: -8,
    height: 0,
  },
};

/**
 * Transition for collapsed strip.
 */
export const collapsedStripTransition: Transition = {
  duration: DURATIONS.standard,
  ease: crispEase,
};

/**
 * Variants for individual tiles in the collapsed strip.
 */
export const collapsedTileVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.8,
  },
  visible: {
    opacity: 1,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 0.8,
  },
};

// ============================================================================
// Header Variants
// ============================================================================

/**
 * Variants for the expanded tile header.
 */
export const headerVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -12,
  },
  visible: {
    opacity: 1,
    x: 0,
  },
  exit: {
    opacity: 0,
    x: -12,
  },
};

/**
 * Transition for header animations.
 */
export const headerTransition: Transition = {
  duration: DURATIONS.standard,
  ease: crispEase,
};

// ============================================================================
// Back Button Variants
// ============================================================================

/**
 * Variants for the back button in the header.
 */
export const backButtonVariants: Variants = {
  rest: {
    x: 0,
  },
  hover: {
    x: -3,
  },
  tap: {
    x: -6,
    scale: 0.95,
  },
};

/**
 * Transition for back button interactions.
 */
export const backButtonTransition: Transition = {
  duration: DURATIONS.micro,
  ease: crispEase,
};

// ============================================================================
// Layout Animation Config
// ============================================================================

/**
 * Layout transition for smooth position/size changes.
 * Use with motion's `layout` prop.
 */
export const layoutTransition: Transition = {
  duration: 0.25,
  ease: crispEase,
};

/**
 * Faster layout transition for smaller movements.
 */
export const quickLayoutTransition: Transition = {
  duration: 0.15,
  ease: crispEase,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate stagger delay for a tile based on its index.
 * Caps the maximum delay to prevent long waits for large grids.
 */
export function getStaggerDelay(index: number, maxDelay = 0.2): number {
  return Math.min(index * DURATIONS.staggerChild, maxDelay);
}

/**
 * Get animation variants for a tile based on its visual state.
 */
export function getTileAnimationState(
  isExpanded: boolean,
  isCollapsedSibling: boolean
): keyof typeof tileContainerVariants {
  if (isExpanded) return "expanded";
  if (isCollapsedSibling) return "collapsedSibling";
  return "normal";
}

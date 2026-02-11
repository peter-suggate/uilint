/**
 * Treemap Animation System
 *
 * Defines animation configurations for the zoomable treemap.
 * Uses motion/react (Framer Motion) for smooth transitions.
 * All animations use crispEase for consistency with the rest of the UI.
 */

import type { Transition, Variants } from "motion/react";
import { crispEase } from "./expansion-animations";

// ============================================================================
// Duration Constants
// ============================================================================

/** Duration for zoom crossfade transitions */
export const ZOOM_DURATION = 0.25;

/** Duration for cell content fade in/out */
export const CELL_CONTENT_DURATION = 0.15;

/** Stagger delay for cells appearing after zoom */
export const CELL_STAGGER = 0.02;

/** Maximum stagger delay cap */
export const MAX_STAGGER_DELAY = 0.15;

// ============================================================================
// Zoom Transition
// ============================================================================

/** Transition for the zoom crossfade container */
export const zoomTransition: Transition = {
  duration: ZOOM_DURATION,
  ease: crispEase,
};

// ============================================================================
// Treemap Cell Variants
// ============================================================================

/** Cell appearance variants (staggered fade-in on mount) */
export const treemapCellVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.97,
  },
  visible: {
    opacity: 1,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
  },
};

/** Transition for individual treemap cells */
export const treemapCellTransition: Transition = {
  duration: CELL_CONTENT_DURATION,
  ease: crispEase,
};

// ============================================================================
// Context Strip Variants
// ============================================================================

/** Context strip slide-in variants */
export const contextStripVariants: Variants = {
  hidden: {
    opacity: 0,
    height: 0,
  },
  visible: {
    opacity: 1,
    height: "auto",
  },
  exit: {
    opacity: 0,
    height: 0,
  },
};

/** Transition for context strip */
export const contextStripTransition: Transition = {
  duration: ZOOM_DURATION,
  ease: crispEase,
};

// ============================================================================
// Zoomed Content Variants
// ============================================================================

/** Content appearing inside zoomed view (delayed until zoom is mostly done) */
export const zoomedContentVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 8,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      delay: ZOOM_DURATION * 0.5,
      duration: CELL_CONTENT_DURATION,
      ease: crispEase,
    },
  },
  exit: {
    opacity: 0,
    y: 8,
  },
};

// ============================================================================
// Root Treemap Exit/Enter Variants
// ============================================================================

/** Root treemap view (exits on zoom-in, enters on zoom-out) */
export const rootTreemapVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
  },
};

/** Zoomed view (enters on zoom-in, exits on zoom-out) */
export const zoomedViewVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 1.02,
  },
  visible: {
    opacity: 1,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 1.02,
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate stagger delay for a cell based on its index.
 * Caps the maximum delay to prevent long waits for large treemaps.
 */
export function getCellStaggerDelay(index: number): number {
  return Math.min(index * CELL_STAGGER, MAX_STAGGER_DELAY);
}

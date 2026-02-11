/**
 * Treemap Inspector Store
 *
 * Standalone Zustand store for treemap-specific state that doesn't belong
 * in the composed store. Navigation state (expandedRuleId, expandedFilePath,
 * selectedIssueId) stays in the composed store since external consumers
 * (HeatmapOverlay, CommandPalette) dispatch there.
 *
 * This store owns:
 * - Container dimensions (measured via ResizeObserver)
 * - Animation state (transition phase, direction, previous zoomed rule)
 * - Pre-computed file children for ghost cell rendering
 */
import { create } from "zustand";
import type { BaseTileItem } from "../HierarchicalTiles/TileGrid";

// ============================================================================
// Types
// ============================================================================

export interface TreemapInspectorState {
  // ===== Container dimensions =====
  /** Measured container width */
  containerWidth: number;
  /** Measured container height */
  containerHeight: number;
  /** Update container dimensions (from ResizeObserver) */
  setContainerSize: (width: number, height: number) => void;

  // ===== Animation state =====
  /** Whether a zoom transition is currently in progress */
  isTransitioning: boolean;
  /** Direction of the current transition */
  transitionDirection: "zoom-in" | "zoom-out" | null;
  /** Previous zoomed rule ID — keeps ghost cells mounted during zoom-out */
  previousZoomedRuleId: string | null;
  /** Start a zoom transition */
  startTransition: (
    direction: "zoom-in" | "zoom-out",
    previousRuleId?: string | null
  ) => void;
  /** End the zoom transition (called by onAnimationComplete) */
  endTransition: () => void;

  // ===== Pre-computed file children for ghost cells =====
  /** Map of ruleId → file tile items, computed for all rules */
  fileItemsByRule: Map<string, BaseTileItem[]>;
  /** Update the file items map (typically from a useMemo in the view) */
  setFileItemsByRule: (map: Map<string, BaseTileItem[]>) => void;
}

// ============================================================================
// Store
// ============================================================================

export const useTreemapStore = create<TreemapInspectorState>()((set) => ({
  // Container dimensions
  containerWidth: 0,
  containerHeight: 400,
  setContainerSize: (width, height) =>
    set({ containerWidth: width, containerHeight: height }),

  // Animation state
  isTransitioning: false,
  transitionDirection: null,
  previousZoomedRuleId: null,
  startTransition: (direction, previousRuleId) =>
    set({
      isTransitioning: true,
      transitionDirection: direction,
      previousZoomedRuleId: previousRuleId ?? null,
    }),
  endTransition: () =>
    set({
      isTransitioning: false,
      transitionDirection: null,
      previousZoomedRuleId: null,
    }),

  // File items for ghost cells
  fileItemsByRule: new Map(),
  setFileItemsByRule: (map) => set({ fileItemsByRule: map }),
}));

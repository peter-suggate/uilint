/**
 * Expanded Layout Algorithm
 *
 * Calculates positions for all tiles when one tile is expanded to show children.
 *
 * Algorithm:
 * 1. Calculate original mosaic layout for all tiles
 * 2. If a tile is expanded:
 *    a. Calculate children layout to determine expanded height
 *    b. Find expanded tile's original Y position
 *    c. Separate tiles into ABOVE (keep position) and DISPLACED (reflow below)
 *    d. Place expanded tile at original Y, full width
 *    e. Re-layout displaced tiles below the expanded tile
 * 3. Return final positions for all tiles
 */

import { calculateMosaicLayout } from "./mosaic-layout";
import type { LayoutItem } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface ExpandedLayoutConfig {
  /** Available width for the grid (default: 532) */
  availableWidth?: number;
  /** Gap between tiles (default: 14) */
  gap?: number;
  /** Padding around the grid */
  padding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

/** Internal type with all values resolved (no optional properties) */
interface ResolvedLayoutConfig {
  availableWidth: number;
  gap: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface ExpandedLayoutInput {
  /** All items in the grid */
  items: LayoutItem[];
  /** ID of the expanded tile, or null if none */
  expandedId: string | null;
  /** Children of the expanded tile */
  children: LayoutItem[];
  /** Layout configuration */
  config?: ExpandedLayoutConfig;
  /** Extra height to add to expanded tile (for custom content like RuleHeader, RuleConfig) */
  extraExpandedHeight?: number;
}

export interface TilePosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExpandedLayoutResult {
  /** Map of tile ID to position */
  positions: Map<string, TilePosition>;
  /** Position of the expanded tile (if any) */
  expandedPosition: TilePosition | null;
  /** Total height of the layout */
  totalHeight: number;
  /** Height of the children grid inside the expanded tile */
  childrenHeight: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: ResolvedLayoutConfig = {
  availableWidth: 532,
  gap: 14,
  padding: { top: 20, right: 24, bottom: 20, left: 24 },
};

const EXPANDED_HEADER_HEIGHT = 52;
const EXPANDED_CONTENT_PADDING = 12;
const CHILDREN_GAP = 10;

// ============================================================================
// Main Function
// ============================================================================

export function calculateExpandedLayout(input: ExpandedLayoutInput): ExpandedLayoutResult {
  const { items, expandedId, children } = input;
  const config = mergeConfig(input.config);

  // Handle empty items
  if (items.length === 0) {
    return {
      positions: new Map(),
      expandedPosition: null,
      totalHeight: config.padding.top + config.padding.bottom,
      childrenHeight: 0,
    };
  }

  // Calculate original layout for all items
  const originalLayout = calculateMosaicLayout(items, {
    availableWidth: config.availableWidth,
    gap: config.gap,
    padding: config.padding,
  });

  // If no tile is expanded, return original layout
  if (!expandedId) {
    const positions = new Map<string, TilePosition>();
    for (const item of items) {
      const layout = originalLayout.tiles.get(item.id);
      if (layout) {
        positions.set(item.id, {
          id: item.id,
          x: layout.x,
          y: layout.y,
          width: parseFloat(layout.width),
          height: layout.height,
        });
      }
    }
    return {
      positions,
      expandedPosition: null,
      totalHeight: originalLayout.totalHeight,
      childrenHeight: 0,
    };
  }

  // Get expanded tile's original position
  const expandedOriginal = originalLayout.tiles.get(expandedId);
  if (!expandedOriginal) {
    // Expanded tile not found - fall back to normal layout
    const positions = new Map<string, TilePosition>();
    for (const item of items) {
      const layout = originalLayout.tiles.get(item.id);
      if (layout) {
        positions.set(item.id, {
          id: item.id,
          x: layout.x,
          y: layout.y,
          width: parseFloat(layout.width),
          height: layout.height,
        });
      }
    }
    return {
      positions,
      expandedPosition: null,
      totalHeight: originalLayout.totalHeight,
      childrenHeight: 0,
    };
  }

  // Calculate children layout to determine expanded height
  const childrenLayout = calculateChildrenHeight(children, config);
  const extraHeight = input.extraExpandedHeight ?? 0;
  const expandedHeight = EXPANDED_HEADER_HEIGHT + childrenLayout.totalHeight + EXPANDED_CONTENT_PADDING * 2 + extraHeight;

  // The Y position where the expanded tile starts
  const expandedY = expandedOriginal.y;

  // Separate tiles into ABOVE and DISPLACED
  const tilesAbove: LayoutItem[] = [];
  const tilesDisplaced: LayoutItem[] = [];

  for (const item of items) {
    if (item.id === expandedId) continue;

    const layout = originalLayout.tiles.get(item.id);
    if (!layout) continue;

    // A tile is ABOVE if its bottom edge is at or above the expanded tile's top edge
    const tileBottom = layout.y + layout.height;
    if (tileBottom <= expandedY) {
      tilesAbove.push(item);
    } else {
      tilesDisplaced.push(item);
    }
  }

  // Build final positions map
  const positions = new Map<string, TilePosition>();

  // Tiles above keep their original positions
  for (const item of tilesAbove) {
    const layout = originalLayout.tiles.get(item.id)!;
    positions.set(item.id, {
      id: item.id,
      x: layout.x,
      y: layout.y,
      width: parseFloat(layout.width),
      height: layout.height,
    });
  }

  // Expanded tile: full width at original Y
  const expandedPosition: TilePosition = {
    id: expandedId,
    x: config.padding.left,
    y: expandedY,
    width: config.availableWidth,
    height: expandedHeight,
  };
  positions.set(expandedId, expandedPosition);

  // Calculate where displaced tiles start
  const displacedStartY = expandedY + expandedHeight + config.gap;

  // Re-layout displaced tiles
  if (tilesDisplaced.length > 0) {
    const displacedLayout = calculateMosaicLayout(tilesDisplaced, {
      availableWidth: config.availableWidth,
      gap: config.gap,
      padding: { top: 0, right: 0, bottom: config.padding.bottom, left: 0 },
    });

    for (const item of tilesDisplaced) {
      const layout = displacedLayout.tiles.get(item.id);
      if (layout) {
        positions.set(item.id, {
          id: item.id,
          x: layout.x + config.padding.left,
          y: layout.y + displacedStartY,
          width: parseFloat(layout.width),
          height: layout.height,
        });
      }
    }

    const totalHeight = displacedStartY + displacedLayout.totalHeight;
    return {
      positions,
      expandedPosition,
      totalHeight,
      childrenHeight: childrenLayout.totalHeight,
    };
  }

  // No displaced tiles
  const totalHeight = expandedY + expandedHeight + config.padding.bottom;
  return {
    positions,
    expandedPosition,
    totalHeight,
    childrenHeight: childrenLayout.totalHeight,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function mergeConfig(config?: ExpandedLayoutConfig): ResolvedLayoutConfig {
  return {
    availableWidth: config?.availableWidth ?? DEFAULT_CONFIG.availableWidth,
    gap: config?.gap ?? DEFAULT_CONFIG.gap,
    padding: {
      top: config?.padding?.top ?? DEFAULT_CONFIG.padding.top,
      right: config?.padding?.right ?? DEFAULT_CONFIG.padding.right,
      bottom: config?.padding?.bottom ?? DEFAULT_CONFIG.padding.bottom,
      left: config?.padding?.left ?? DEFAULT_CONFIG.padding.left,
    },
  };
}

/**
 * Calculate the height of children grid using mosaic layout
 */
function calculateChildrenHeight(
  children: LayoutItem[],
  config: ResolvedLayoutConfig
): { totalHeight: number } {
  if (children.length === 0) {
    return { totalHeight: 0 };
  }

  // Use mosaic layout for children to get accurate height
  // Children grid width = expanded tile width - content padding on each side
  // Expanded tile width = availableWidth (532)
  // Content padding = EXPANDED_CONTENT_PADDING (12px) on each side = 24px total
  const childrenWidth = config.availableWidth - EXPANDED_CONTENT_PADDING * 2;

  const layout = calculateMosaicLayout(children, {
    availableWidth: childrenWidth,
    gap: CHILDREN_GAP,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  return { totalHeight: layout.totalHeight };
}

/**
 * Mosaic Layout Calculator - True Bin-Packing Algorithm
 *
 * Places tiles largest to smallest, filling vertical gaps efficiently.
 * Uses absolute positioning for true masonry effect.
 */

import type { TileBucket } from "../../../../core/plugin-system/types";
import type {
  TileLayout,
  MosaicLayoutResult,
  MosaicLayoutConfig,
  LayoutItem,
} from "./types";

// Default padding
const DEFAULT_PADDING = { top: 0, right: 0, bottom: 0, left: 0 };

// Default configuration
// Available width matches command palette content area: 560 - 112 (sidebar) - 32 (padding) = 416
const DEFAULT_CONFIG = {
  availableWidth: 416,
  gap: 12,
  minTileWidth: 120,
  padding: DEFAULT_PADDING,
};

// Bucket heights in pixels
const BUCKET_HEIGHTS: Record<TileBucket, number> = {
  xs: 72,
  sm: 96,
  md: 128,
  lg: 168,
  xl: 220,
};

/**
 * Calculate bucket size based on normalized percentiles.
 */
export function calculateBucket(count: number, sortedCounts: number[]): TileBucket {
  if (sortedCounts.length === 0) return "md";

  const total = sortedCounts.length;
  const position = sortedCounts.findIndex((c) => count >= c);
  const percentile = position === -1 ? 1 : position / total;

  if (percentile < 0.1) return "xl";
  if (percentile < 0.3) return "lg";
  if (percentile < 0.6) return "md";
  if (percentile < 0.85) return "sm";
  return "xs";
}

/**
 * Calculate buckets for all items based on their counts
 */
export function calculateBuckets(items: LayoutItem[]): Map<string, TileBucket> {
  const sortedCounts = items.map((item) => item.count).sort((a, b) => b - a);
  const buckets = new Map<string, TileBucket>();

  for (const item of items) {
    buckets.set(item.id, calculateBucket(item.count, sortedCounts));
  }

  return buckets;
}

// FreeSpace interface removed - not currently used but kept for future bin-packing algorithm

/**
 * Calculate optimal column count
 */
function calculateColumnCount(
  availableWidth: number,
  gap: number,
  minTileWidth: number
): number {
  // Calculate max columns that fit with minimum width
  for (let cols = 3; cols >= 1; cols--) {
    const tileWidth = (availableWidth - gap * (cols - 1)) / cols;
    if (tileWidth >= minTileWidth) {
      return cols;
    }
  }
  return 1;
}

/**
 * Calculate tile width for a given column span
 */
function calculateTileWidth(
  columnSpan: number,
  totalColumns: number,
  availableWidth: number,
  gap: number
): number {
  const singleColumnWidth = (availableWidth - gap * (totalColumns - 1)) / totalColumns;
  return singleColumnWidth * columnSpan + gap * (columnSpan - 1);
}

/**
 * Determine column span based on bucket size and column count
 */
function getColumnSpan(bucket: TileBucket, totalColumns: number, isFirst: boolean): number {
  if (totalColumns === 1) return 1;

  // For 2 columns
  if (totalColumns === 2) {
    if (bucket === "xl" && isFirst) return 2; // Hero spans full width
    return 1;
  }

  // For 3 columns
  if (bucket === "xl" && isFirst) return 3; // Hero spans full width
  if (bucket === "lg") return 2; // Large items span 2 columns
  return 1;
}

/**
 * Find the best position for a tile using bin-packing strategy
 */
function findBestPosition(
  width: number,
  height: number,
  columnHeights: number[],
  columnCount: number,
  columnSpan: number,
  gap: number,
  availableWidth: number
): { x: number; y: number; columns: number[] } {
  const singleColumnWidth = (availableWidth - gap * (columnCount - 1)) / columnCount;

  // Find the column range with the lowest maximum height
  let bestStartCol = 0;
  let bestY = Infinity;

  for (let startCol = 0; startCol <= columnCount - columnSpan; startCol++) {
    // Get the max height across the columns this tile would span
    let maxHeight = 0;
    for (let c = startCol; c < startCol + columnSpan; c++) {
      maxHeight = Math.max(maxHeight, columnHeights[c]);
    }

    if (maxHeight < bestY) {
      bestY = maxHeight;
      bestStartCol = startCol;
    }
  }

  const x = bestStartCol * (singleColumnWidth + gap);
  const affectedColumns = [];
  for (let c = bestStartCol; c < bestStartCol + columnSpan; c++) {
    affectedColumns.push(c);
  }

  return { x, y: bestY, columns: affectedColumns };
}

/**
 * Main bin-packing mosaic layout algorithm
 */
export function calculateMosaicLayout(
  items: LayoutItem[],
  config: MosaicLayoutConfig = {}
): MosaicLayoutResult {
  // Merge padding separately to handle partial padding objects
  const padding = {
    ...DEFAULT_PADDING,
    ...config.padding,
  };

  if (items.length === 0) {
    return {
      tiles: new Map(),
      rowCount: 0,
      columnCount: 0,
      pattern: "grid",
      totalHeight: padding.top + padding.bottom,
    };
  }

  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    padding,
  };

  const { availableWidth, gap, minTileWidth } = mergedConfig;
  const { top: paddingTop, left: paddingLeft, bottom: paddingBottom } = padding;
  const columnCount = calculateColumnCount(availableWidth, gap, minTileWidth);

  // Calculate buckets for all items
  const buckets = calculateBuckets(items);

  // Sort items by count (descending) - place largest first
  const sortedItems = [...items].sort((a, b) => b.count - a.count);

  // Track height of each column
  const columnHeights = new Array(columnCount).fill(0);

  const tiles = new Map<string, TileLayout>();

  sortedItems.forEach((item, index) => {
    const bucket = buckets.get(item.id) || "md";
    const height = BUCKET_HEIGHTS[bucket];
    const isFirst = index === 0;

    // Determine column span
    const columnSpan = getColumnSpan(bucket, columnCount, isFirst);
    const width = calculateTileWidth(columnSpan, columnCount, availableWidth, gap);

    // Find best position using bin-packing
    const { x, y, columns } = findBestPosition(
      width,
      height,
      columnHeights,
      columnCount,
      columnSpan,
      gap,
      availableWidth
    );

    // Update column heights
    for (const col of columns) {
      columnHeights[col] = y + height + gap;
    }

    tiles.set(item.id, {
      id: item.id,
      row: 0, // Not used for absolute positioning
      column: columns[0],
      width: `${width}px`,
      widthFraction: columnSpan / columnCount,
      bucket,
      isRowStart: columns[0] === 0,
      // Absolute positioning values (with padding offset)
      x: x + paddingLeft,
      y: y + paddingTop,
      height,
    });
  });

  const totalHeight = Math.max(...columnHeights) - gap + paddingTop + paddingBottom; // Remove trailing gap, add padding

  // Determine pattern based on item count
  let pattern: MosaicLayoutResult["pattern"] = "grid";
  if (items.length === 1) pattern = "single";
  else if (items.length === 2) pattern = "pair";
  else if (items.length === 3) pattern = "trio";
  else if (items.length === 4) pattern = "quad";

  return {
    tiles,
    rowCount: Math.ceil(items.length / columnCount),
    columnCount,
    pattern,
    totalHeight,
  };
}

/**
 * Group tiles by row for rendering (kept for backwards compatibility)
 */
export function groupTilesByRow<T extends { id: string }>(
  items: T[],
  layout: MosaicLayoutResult
): T[][] {
  // For absolute positioning, we return all items in a single "row"
  // since they're positioned absolutely
  if (items.length === 0) return [];

  // Sort by y position, then x position
  const sorted = [...items].sort((a, b) => {
    const layoutA = layout.tiles.get(a.id);
    const layoutB = layout.tiles.get(b.id);
    const yDiff = (layoutA?.y ?? 0) - (layoutB?.y ?? 0);
    if (Math.abs(yDiff) > 10) return yDiff; // Different rows
    return (layoutA?.x ?? 0) - (layoutB?.x ?? 0);
  });

  return [sorted];
}

/**
 * Get bucket height in pixels
 */
export function getBucketHeight(bucket: TileBucket): number {
  return BUCKET_HEIGHTS[bucket];
}

// ============================================================================
// Expanded Tile Layout Helpers
// ============================================================================

/**
 * Configuration for collapsed tile strip layout
 */
export interface CollapsedStripConfig {
  /** Width of each collapsed tile */
  tileWidth?: number;
  /** Height of collapsed tiles */
  tileHeight?: number;
  /** Gap between tiles */
  gap?: number;
  /** Padding around the strip */
  padding?: number;
}

const DEFAULT_COLLAPSED_CONFIG: Required<CollapsedStripConfig> = {
  tileWidth: 100,
  tileHeight: 56,
  gap: 8,
  padding: 12,
};

/**
 * Layout info for a collapsed tile in the strip
 */
export interface CollapsedTileLayout {
  id: string;
  x: number;
  width: number;
  height: number;
}

/**
 * Calculate layout for collapsed tiles in horizontal strip
 */
export function calculateCollapsedStripLayout(
  items: LayoutItem[],
  config: CollapsedStripConfig = {}
): {
  tiles: CollapsedTileLayout[];
  totalWidth: number;
  height: number;
} {
  const mergedConfig = { ...DEFAULT_COLLAPSED_CONFIG, ...config };
  const { tileWidth, tileHeight, gap, padding } = mergedConfig;

  if (items.length === 0) {
    return { tiles: [], totalWidth: padding * 2, height: tileHeight + padding * 2 };
  }

  const tiles: CollapsedTileLayout[] = items.map((item, index) => ({
    id: item.id,
    x: padding + index * (tileWidth + gap),
    width: tileWidth,
    height: tileHeight,
  }));

  const totalWidth = padding * 2 + items.length * tileWidth + (items.length - 1) * gap;
  const height = tileHeight + padding * 2;

  return { tiles, totalWidth, height };
}

/**
 * Calculate layout for children within an expanded tile
 * Uses a simpler grid layout (not masonry) for consistency
 */
export interface ChildGridConfig {
  /** Available width for the grid */
  availableWidth?: number;
  /** Number of columns */
  columns?: number;
  /** Gap between tiles */
  gap?: number;
  /** Tile height */
  tileHeight?: number;
}

const DEFAULT_CHILD_GRID_CONFIG: Required<ChildGridConfig> = {
  availableWidth: 480,
  columns: 3,
  gap: 8,
  tileHeight: 80,
};

/**
 * Layout info for a child tile in the grid
 */
export interface ChildTileLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  column: number;
}

/**
 * Calculate layout for child tiles in a simple grid
 */
export function calculateChildGridLayout(
  items: LayoutItem[],
  config: ChildGridConfig = {}
): {
  tiles: ChildTileLayout[];
  totalHeight: number;
  columns: number;
} {
  const mergedConfig = { ...DEFAULT_CHILD_GRID_CONFIG, ...config };
  const { availableWidth, columns, gap, tileHeight } = mergedConfig;

  if (items.length === 0) {
    return { tiles: [], totalHeight: 0, columns };
  }

  const tileWidth = (availableWidth - gap * (columns - 1)) / columns;
  const rows = Math.ceil(items.length / columns);

  const tiles: ChildTileLayout[] = items.map((item, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    return {
      id: item.id,
      x: column * (tileWidth + gap),
      y: row * (tileHeight + gap),
      width: tileWidth,
      height: tileHeight,
      row,
      column,
    };
  });

  const totalHeight = rows * tileHeight + (rows - 1) * gap;

  return { tiles, totalHeight, columns };
}

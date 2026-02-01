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

// Default configuration
// Available width matches command palette content area: 560 - 112 (sidebar) - 32 (padding) = 416
const DEFAULT_CONFIG: Required<MosaicLayoutConfig> = {
  availableWidth: 416,
  gap: 12,
  minTileWidth: 120,
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

/**
 * Represents a free rectangular space in the layout grid
 */
interface FreeSpace {
  x: number;
  y: number;
  width: number;
  height: number; // Infinity for open-ended bottom
}

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
  if (items.length === 0) {
    return {
      tiles: new Map(),
      rowCount: 0,
      columnCount: 0,
      pattern: "grid",
      totalHeight: 0,
    };
  }

  const mergedConfig: Required<MosaicLayoutConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  const { availableWidth, gap, minTileWidth } = mergedConfig;
  const columnCount = calculateColumnCount(availableWidth, gap, minTileWidth);
  const singleColumnWidth = (availableWidth - gap * (columnCount - 1)) / columnCount;

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
      // Absolute positioning values
      x,
      y,
      height,
    });
  });

  const totalHeight = Math.max(...columnHeights) - gap; // Remove trailing gap

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

/**
 * Mosaic Layout Calculator
 *
 * Pure functions for calculating tile positions in a flexbox-based mosaic grid.
 * Special layouts for 1-4 items, grid layout for 5+ items.
 */

import type { TileBucket } from "../../../../core/plugin-system/types";
import type {
  TileLayout,
  MosaicLayoutResult,
  MosaicLayoutConfig,
  LayoutItem,
} from "./types";

// Default configuration
const DEFAULT_CONFIG: Required<MosaicLayoutConfig> = {
  availableWidth: 500,
  gap: 12,
  minTileWidth: 140,
};

/**
 * Calculate bucket size based on normalized percentiles.
 *
 * Distribution:
 * - Top 10% by count = xl
 * - Next 20% = lg
 * - Next 30% = md
 * - Next 25% = sm
 * - Bottom 15% = xs
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
 * Calculate CSS width string for a given fraction
 */
function widthFromFraction(fraction: number, gap: number): string {
  if (fraction === 1) return "100%";
  // Account for gap between items: width = fraction * (100% - gaps)
  // For 2 items: each gets (100% - gap) / 2
  // For 3 items: each gets (100% - 2*gap) / 3
  const gapAdjustment = gap * (1 / fraction - 1);
  return `calc(${(fraction * 100).toFixed(1)}% - ${gapAdjustment.toFixed(0)}px)`;
}

/**
 * Single item layout - full width hero tile
 */
function calculateSingleLayout(
  items: LayoutItem[],
  buckets: Map<string, TileBucket>
): MosaicLayoutResult {
  const item = items[0];
  const tiles = new Map<string, TileLayout>();

  tiles.set(item.id, {
    id: item.id,
    row: 0,
    column: 0,
    width: "100%",
    widthFraction: 1,
    bucket: "xl", // Single item is always hero size
    isRowStart: true,
  });

  return {
    tiles,
    rowCount: 1,
    columnCount: 1,
    pattern: "single",
  };
}

/**
 * Calculate width ratio for pair layout based on count ratio
 */
function getPairWidthRatio(count1: number, count2: number): [number, number] {
  const ratio = count1 / (count1 + count2);

  // Equal-ish (within 30% of each other) -> 50/50
  if (ratio >= 0.35 && ratio <= 0.65) {
    return [0.5, 0.5];
  }
  // Dominant first -> 60/40
  if (ratio > 0.65 && ratio <= 0.75) {
    return [0.6, 0.4];
  }
  // Very dominant first -> 65/35
  if (ratio > 0.75) {
    return [0.65, 0.35];
  }
  // Dominant second -> 40/60
  if (ratio < 0.35 && ratio >= 0.25) {
    return [0.4, 0.6];
  }
  // Very dominant second -> 35/65
  return [0.35, 0.65];
}

/**
 * Pair layout - two items side by side with proportional widths
 */
function calculatePairLayout(
  items: LayoutItem[],
  buckets: Map<string, TileBucket>,
  config: Required<MosaicLayoutConfig>
): MosaicLayoutResult {
  const tiles = new Map<string, TileLayout>();
  const [ratio1, ratio2] = getPairWidthRatio(items[0].count, items[1].count);

  tiles.set(items[0].id, {
    id: items[0].id,
    row: 0,
    column: 0,
    width: widthFromFraction(ratio1, config.gap),
    widthFraction: ratio1,
    bucket: buckets.get(items[0].id) || "lg",
    isRowStart: true,
  });

  tiles.set(items[1].id, {
    id: items[1].id,
    row: 0,
    column: 1,
    width: widthFromFraction(ratio2, config.gap),
    widthFraction: ratio2,
    bucket: buckets.get(items[1].id) || "lg",
    isRowStart: false,
  });

  return {
    tiles,
    rowCount: 1,
    columnCount: 2,
    pattern: "pair",
  };
}

/**
 * Trio layout - featured (1 full + 2 below) or equal (3 columns)
 */
function calculateTrioLayout(
  items: LayoutItem[],
  buckets: Map<string, TileBucket>,
  config: Required<MosaicLayoutConfig>
): MosaicLayoutResult {
  const tiles = new Map<string, TileLayout>();
  const [first, second, third] = items;

  // Check if first item is dominant (2x or more than the average of others)
  const avgOthers = (second.count + third.count) / 2;
  const isDominant = first.count >= avgOthers * 2;

  if (isDominant) {
    // Featured layout: 1 full-width on top, 2 below
    tiles.set(first.id, {
      id: first.id,
      row: 0,
      column: 0,
      width: "100%",
      widthFraction: 1,
      bucket: "xl",
      isRowStart: true,
    });

    tiles.set(second.id, {
      id: second.id,
      row: 1,
      column: 0,
      width: widthFromFraction(0.5, config.gap),
      widthFraction: 0.5,
      bucket: buckets.get(second.id) || "md",
      isRowStart: true,
    });

    tiles.set(third.id, {
      id: third.id,
      row: 1,
      column: 1,
      width: widthFromFraction(0.5, config.gap),
      widthFraction: 0.5,
      bucket: buckets.get(third.id) || "md",
      isRowStart: false,
    });

    return {
      tiles,
      rowCount: 2,
      columnCount: 2,
      pattern: "trio",
    };
  } else {
    // Equal layout: 3 columns
    const fraction = 1 / 3;

    items.forEach((item, index) => {
      tiles.set(item.id, {
        id: item.id,
        row: 0,
        column: index,
        width: widthFromFraction(fraction, config.gap),
        widthFraction: fraction,
        bucket: buckets.get(item.id) || "md",
        isRowStart: index === 0,
      });
    });

    return {
      tiles,
      rowCount: 1,
      columnCount: 3,
      pattern: "trio",
    };
  }
}

/**
 * Quad layout - 2x2 grid with proportional bucket sizes
 */
function calculateQuadLayout(
  items: LayoutItem[],
  buckets: Map<string, TileBucket>,
  config: Required<MosaicLayoutConfig>
): MosaicLayoutResult {
  const tiles = new Map<string, TileLayout>();

  items.forEach((item, index) => {
    const row = Math.floor(index / 2);
    const column = index % 2;

    tiles.set(item.id, {
      id: item.id,
      row,
      column,
      width: widthFromFraction(0.5, config.gap),
      widthFraction: 0.5,
      bucket: buckets.get(item.id) || "md",
      isRowStart: column === 0,
    });
  });

  return {
    tiles,
    rowCount: 2,
    columnCount: 2,
    pattern: "quad",
  };
}

/**
 * Calculate optimal column count for grid layout
 */
function calculateOptimalColumns(
  itemCount: number,
  availableWidth: number,
  gap: number,
  minTileWidth: number
): number {
  // Start with 3 columns and reduce until tiles meet minimum width
  for (let cols = 3; cols >= 2; cols--) {
    const tileWidth = (availableWidth - gap * (cols - 1)) / cols;
    if (tileWidth >= minTileWidth) {
      return cols;
    }
  }
  // Fallback to 2 columns minimum
  return 2;
}

/**
 * Grid layout - standard grid for 5+ items
 */
function calculateGridLayout(
  items: LayoutItem[],
  buckets: Map<string, TileBucket>,
  config: Required<MosaicLayoutConfig>
): MosaicLayoutResult {
  const tiles = new Map<string, TileLayout>();
  const columnCount = calculateOptimalColumns(
    items.length,
    config.availableWidth,
    config.gap,
    config.minTileWidth
  );

  const fraction = 1 / columnCount;

  items.forEach((item, index) => {
    const row = Math.floor(index / columnCount);
    const column = index % columnCount;

    tiles.set(item.id, {
      id: item.id,
      row,
      column,
      width: widthFromFraction(fraction, config.gap),
      widthFraction: fraction,
      bucket: buckets.get(item.id) || "md",
      isRowStart: column === 0,
    });
  });

  const rowCount = Math.ceil(items.length / columnCount);

  return {
    tiles,
    rowCount,
    columnCount,
    pattern: "grid",
  };
}

/**
 * Main entry point for calculating mosaic layout
 *
 * @param items - Array of items with id and count
 * @param config - Optional configuration overrides
 * @returns Layout result with tile positions and pattern
 */
export function calculateMosaicLayout(
  items: LayoutItem[],
  config: MosaicLayoutConfig = {}
): MosaicLayoutResult {
  // Handle empty case
  if (items.length === 0) {
    return {
      tiles: new Map(),
      rowCount: 0,
      columnCount: 0,
      pattern: "grid",
    };
  }

  // Merge config with defaults
  const mergedConfig: Required<MosaicLayoutConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // Calculate buckets for all items
  const buckets = calculateBuckets(items);

  // Sort items by count (descending) for consistent layout
  const sortedItems = [...items].sort((a, b) => b.count - a.count);

  // Choose layout pattern based on item count
  switch (sortedItems.length) {
    case 1:
      return calculateSingleLayout(sortedItems, buckets);
    case 2:
      return calculatePairLayout(sortedItems, buckets, mergedConfig);
    case 3:
      return calculateTrioLayout(sortedItems, buckets, mergedConfig);
    case 4:
      return calculateQuadLayout(sortedItems, buckets, mergedConfig);
    default:
      return calculateGridLayout(sortedItems, buckets, mergedConfig);
  }
}

/**
 * Group tiles by row for rendering.
 * Generic function that works with any type that has an `id` property.
 */
export function groupTilesByRow<T extends { id: string }>(
  items: T[],
  layout: MosaicLayoutResult
): T[][] {
  const rows: T[][] = [];

  for (let i = 0; i < layout.rowCount; i++) {
    rows.push([]);
  }

  for (const item of items) {
    const tileLayout = layout.tiles.get(item.id);
    if (tileLayout) {
      rows[tileLayout.row].push(item);
    }
  }

  // Sort items within each row by column
  for (const row of rows) {
    row.sort((a, b) => {
      const layoutA = layout.tiles.get(a.id);
      const layoutB = layout.tiles.get(b.id);
      return (layoutA?.column ?? 0) - (layoutB?.column ?? 0);
    });
  }

  return rows;
}

/**
 * Mosaic Layout Calculator - Skyline Bin-Packing Algorithm
 *
 * Uses Skyline bin-packing for variable-sized rectangles.
 * Tiles have dimensions based on:
 * - Surface area proportional to log(count)
 * - Aspect ratio based on label length
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
const DEFAULT_CONFIG = {
  availableWidth: 416,
  gap: 12,
  minTileWidth: 100,
  maxTileWidth: 320,
  minTileHeight: 110, // Increased to fit path + title + issue summary
  maxTileHeight: 280,
  minArea: 8_000,
  maxArea: 60_000,
  padding: DEFAULT_PADDING,
};

// ============================================================================
// Skyline Types
// ============================================================================

/** A segment in the skyline contour */
interface SkylineNode {
  x: number;
  y: number;
  width: number;
}

/** A tile with calculated dimensions before packing */
interface SizedTile {
  id: string;
  width: number;
  height: number;
  originalIndex: number;
}

/** A tile with its packed position */
interface PackedTile {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================================
// Dimension Calculation
// ============================================================================

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate ideal tile dimensions based on issue count and label length.
 *
 * - Area is proportional to log(count) for better visual balance
 * - Aspect ratio is based on label length (longer labels = wider tiles)
 */
function calculateIdealDimensions(
  item: LayoutItem,
  totalIssues: number,
  config: typeof DEFAULT_CONFIG
): { width: number; height: number } {
  // Calculate area from count using log scaling
  // This prevents extreme size differences between tiles
  // Handle edge cases: negative counts, zero totalIssues
  const safeCount = Math.max(0, item.count);
  const safeTotalIssues = Math.max(1, totalIssues);
  const fraction = safeTotalIssues > 1
    ? Math.log1p(safeCount) / Math.log1p(safeTotalIssues)
    : 1;
  const area = config.minArea + fraction * (config.maxArea - config.minArea);

  // Calculate aspect ratio from label length
  // Short labels → square, long labels → landscape
  const labelLen = item.label?.length ?? 0;
  const subtitleLen = item.subtitle?.length ?? 0;
  const maxLen = Math.max(labelLen, subtitleLen);

  let aspectRatio: number;
  if (maxLen <= 10) {
    aspectRatio = 1.0; // Square
  } else if (maxLen <= 20) {
    aspectRatio = 1.5; // Slight landscape
  } else {
    // Gradually wider for longer labels (2.0 to 3.0)
    aspectRatio = 2.0 + Math.min(1, (maxLen - 20) / 20);
  }

  // Derive dimensions from area and aspect ratio
  // area = width * height
  // aspectRatio = width / height
  // Therefore: width = sqrt(area * aspectRatio), height = sqrt(area / aspectRatio)
  let width = Math.sqrt(area * aspectRatio);
  let height = Math.sqrt(area / aspectRatio);

  // Clamp to min/max constraints
  width = clamp(width, config.minTileWidth, config.maxTileWidth);
  height = clamp(height, config.minTileHeight, config.maxTileHeight);

  return { width: Math.round(width), height: Math.round(height) };
}

// ============================================================================
// Skyline Bin-Packing
// ============================================================================

/**
 * Find the best position for a tile in the skyline.
 * Uses Bottom-Left strategy: find the position with lowest Y that fits.
 */
function findBestSkylinePosition(
  skyline: SkylineNode[],
  tileWidth: number,
  tileHeight: number,
  containerWidth: number,
  gap: number
): { x: number; y: number; skylineIndex: number } {
  let bestX = 0;
  let bestY = Infinity;
  let bestIndex = 0;

  // Try placing the tile starting at each skyline node
  for (let i = 0; i < skyline.length; i++) {
    const node = skyline[i];

    // Check if tile fits horizontally from this position
    const endX = node.x + tileWidth + gap;
    if (endX > containerWidth + gap) continue; // Doesn't fit

    // Find max Y across all skyline nodes this tile would span
    let maxY = node.y;
    let currentX = node.x;

    for (let j = i; j < skyline.length && currentX < node.x + tileWidth; j++) {
      maxY = Math.max(maxY, skyline[j].y);
      currentX += skyline[j].width;
    }

    // Check if this is a better position (lower Y)
    if (maxY < bestY) {
      bestY = maxY;
      bestX = node.x;
      bestIndex = i;
    }
  }

  // If nothing found, place at origin (shouldn't happen with proper initialization)
  if (bestY === Infinity) {
    return { x: 0, y: 0, skylineIndex: 0 };
  }

  return { x: bestX, y: bestY, skylineIndex: bestIndex };
}

/**
 * Update the skyline after placing a tile.
 * Merges the new rectangle into the skyline contour.
 */
function updateSkyline(
  skyline: SkylineNode[],
  tileX: number,
  tileY: number,
  tileWidth: number,
  tileHeight: number,
  gap: number
): SkylineNode[] {
  const newY = tileY + tileHeight + gap;
  const tileEndX = tileX + tileWidth + gap;

  const newSkyline: SkylineNode[] = [];

  for (let i = 0; i < skyline.length; i++) {
    const node = skyline[i];
    const nodeEndX = node.x + node.width;

    // Node is completely before the tile
    if (nodeEndX <= tileX) {
      newSkyline.push(node);
      continue;
    }

    // Node is completely after the tile
    if (node.x >= tileEndX) {
      newSkyline.push(node);
      continue;
    }

    // Node overlaps with tile - need to split

    // Part before tile
    if (node.x < tileX) {
      newSkyline.push({
        x: node.x,
        y: node.y,
        width: tileX - node.x,
      });
    }

    // Part after tile
    if (nodeEndX > tileEndX) {
      newSkyline.push({
        x: tileEndX,
        y: node.y,
        width: nodeEndX - tileEndX,
      });
    }
  }

  // Add the new skyline segment for the tile
  newSkyline.push({
    x: tileX,
    y: newY,
    width: tileWidth + gap,
  });

  // Sort by x position and merge adjacent segments with same Y
  newSkyline.sort((a, b) => a.x - b.x);

  const merged: SkylineNode[] = [];
  for (const node of newSkyline) {
    if (merged.length === 0) {
      merged.push(node);
      continue;
    }

    const last = merged[merged.length - 1];
    const lastEndX = last.x + last.width;

    // Merge if adjacent (or overlapping) and same height
    if (Math.abs(lastEndX - node.x) < 1 && last.y === node.y) {
      last.width = node.x + node.width - last.x;
    } else if (lastEndX >= node.x && last.y === node.y) {
      // Overlapping with same height
      last.width = Math.max(lastEndX, node.x + node.width) - last.x;
    } else {
      merged.push(node);
    }
  }

  return merged;
}

/**
 * Pack tiles using Skyline Bottom-Left algorithm.
 * Sort by height (descending) to place tallest first for better packing.
 */
function packTiles(
  tiles: SizedTile[],
  containerWidth: number,
  gap: number
): PackedTile[] {
  if (tiles.length === 0) return [];

  // Sort by height descending (place tallest first)
  const sorted = [...tiles].sort((a, b) => b.height - a.height);

  // Initialize skyline as a single segment spanning the container
  let skyline: SkylineNode[] = [{ x: 0, y: 0, width: containerWidth }];

  const packed: PackedTile[] = [];

  for (const tile of sorted) {
    const pos = findBestSkylinePosition(
      skyline,
      tile.width,
      tile.height,
      containerWidth,
      gap
    );

    packed.push({
      id: tile.id,
      x: pos.x,
      y: pos.y,
      width: tile.width,
      height: tile.height,
    });

    skyline = updateSkyline(
      skyline,
      pos.x,
      pos.y,
      tile.width,
      tile.height,
      gap
    );
  }

  return packed;
}

// ============================================================================
// Bucket Calculation
// ============================================================================

/**
 * Assign bucket based on surface area for styling purposes.
 */
function getBucketFromArea(height: number, width: number): TileBucket {
  const area = height * width;
  if (area <= 12000) return "xs";
  if (area <= 18000) return "sm";
  if (area <= 28000) return "md";
  if (area <= 42000) return "lg";
  return "xl";
}

/**
 * Calculate bucket size based on normalized percentiles.
 * Kept for backwards compatibility.
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
 * Calculate buckets for all items based on their counts.
 * Kept for backwards compatibility.
 */
export function calculateBuckets(items: LayoutItem[]): Map<string, TileBucket> {
  const sortedCounts = items.map((item) => item.count).sort((a, b) => b - a);
  const buckets = new Map<string, TileBucket>();

  for (const item of items) {
    buckets.set(item.id, calculateBucket(item.count, sortedCounts));
  }

  return buckets;
}

// ============================================================================
// Main Layout Function
// ============================================================================

/**
 * Main Skyline bin-packing mosaic layout algorithm.
 *
 * Tiles have:
 * - Surface area proportional to log(count)
 * - Aspect ratio based on label length
 * - Variable widths and heights (no column snapping)
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

  const { availableWidth, gap } = mergedConfig;
  const { top: paddingTop, left: paddingLeft, bottom: paddingBottom } = padding;

  // Calculate total issues for proportional area
  const totalIssues = items.reduce((sum, item) => sum + item.count, 0);

  // Step 1: Calculate ideal dimensions for each tile
  const sizedTiles: SizedTile[] = items.map((item, index) => {
    const dims = calculateIdealDimensions(item, totalIssues, mergedConfig);
    return {
      id: item.id,
      width: dims.width,
      height: dims.height,
      originalIndex: index,
    };
  });

  // Step 2: Pack tiles using Skyline algorithm
  const packed = packTiles(sizedTiles, availableWidth, gap);

  // Step 3: Convert to TileLayout
  const tiles = new Map<string, TileLayout>();

  let maxY = 0;
  for (const p of packed) {
    const bucket = getBucketFromArea(p.height, p.width);

    tiles.set(p.id, {
      id: p.id,
      row: 0, // Legacy field
      column: 0, // Legacy field
      width: `${p.width}px`,
      widthFraction: p.width / availableWidth,
      bucket,
      isRowStart: p.x === 0,
      x: p.x + paddingLeft,
      y: p.y + paddingTop,
      height: p.height,
    });

    maxY = Math.max(maxY, p.y + p.height);
  }

  const totalHeight = maxY + paddingTop + paddingBottom;

  // Determine pattern based on item count
  let pattern: MosaicLayoutResult["pattern"] = "grid";
  if (items.length === 1) pattern = "single";
  else if (items.length === 2) pattern = "pair";
  else if (items.length === 3) pattern = "trio";
  else if (items.length === 4) pattern = "quad";

  // Estimate column count based on average tile width
  const avgWidth = sizedTiles.reduce((sum, t) => sum + t.width, 0) / sizedTiles.length;
  const estimatedColumns = Math.round(availableWidth / (avgWidth + gap));

  return {
    tiles,
    rowCount: Math.ceil(items.length / Math.max(1, estimatedColumns)),
    columnCount: Math.max(1, estimatedColumns),
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
  if (items.length === 0) return [];

  // Sort by y position, then x position
  const sorted = [...items].sort((a, b) => {
    const layoutA = layout.tiles.get(a.id);
    const layoutB = layout.tiles.get(b.id);
    const yDiff = (layoutA?.y ?? 0) - (layoutB?.y ?? 0);
    if (Math.abs(yDiff) > 10) return yDiff;
    return (layoutA?.x ?? 0) - (layoutB?.x ?? 0);
  });

  return [sorted];
}

// Bucket heights mapping (for getBucketHeight compatibility)
const BUCKET_HEIGHTS: Record<TileBucket, number> = {
  xs: 115,
  sm: 140,
  md: 185,
  lg: 240,
  xl: 280,
};

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

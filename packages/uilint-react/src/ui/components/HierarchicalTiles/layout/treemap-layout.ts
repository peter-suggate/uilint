/**
 * Squarified Treemap Layout Algorithm
 *
 * Implements the squarified treemap algorithm (Bruls, Huizing, van Wijk 2000)
 * for calculating space-filling rectangular layouts where area encodes value.
 *
 * Properties:
 * - Deterministic: same input always produces same output
 * - Space-filling: cells cover the entire rectangle with no gaps
 * - Squarified: cells have aspect ratios close to 1:1
 * - Sorted: largest items get the most square cells
 */

import type { TreemapCellLayout, TreemapLayoutConfig } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface TreemapItem {
  id: string;
  /** Value determining area (e.g., issue count). Must be >= 0. */
  value: number;
  /** Label for display */
  label?: string;
}

export interface TreemapLayoutResult {
  cells: Map<string, TreemapCellLayout>;
  totalWidth: number;
  totalHeight: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: Required<TreemapLayoutConfig> = {
  width: 500,
  height: 400,
  gap: 2,
  minLabelDimension: 40,
};

// ============================================================================
// Main Function
// ============================================================================

/**
 * Calculate squarified treemap layout.
 *
 * Items are sorted by value descending internally.
 * Produces cells with aspect ratios close to 1:1.
 * Items with value <= 0 are filtered out.
 */
export function calculateTreemapLayout(
  items: TreemapItem[],
  config?: Partial<TreemapLayoutConfig>
): TreemapLayoutResult {
  const cfg = resolveConfig(config);

  const emptyResult: TreemapLayoutResult = {
    cells: new Map(),
    totalWidth: cfg.width,
    totalHeight: cfg.height,
  };

  // Filter out zero/negative values and sort by value descending
  const validItems = items.filter((item) => item.value > 0);
  if (validItems.length === 0) return emptyResult;

  const sorted = [...validItems].sort((a, b) => b.value - a.value);

  // Calculate total value for area normalization
  const totalValue = sorted.reduce((sum, item) => sum + item.value, 0);

  // Available area after accounting for gap
  const totalArea = cfg.width * cfg.height;

  // Run squarify algorithm
  const rects = squarify(
    sorted.map((item) => ({
      id: item.id,
      area: (item.value / totalValue) * totalArea,
    })),
    { x: 0, y: 0, width: cfg.width, height: cfg.height }
  );

  // Convert to TreemapCellLayout with gap insets
  const cells = new Map<string, TreemapCellLayout>();
  const halfGap = cfg.gap / 2;
  const maxArea = Math.max(...sorted.map((item) => item.value));

  for (const rect of rects) {
    // Inset by half-gap on each side
    const x = rect.x + halfGap;
    const y = rect.y + halfGap;
    const width = Math.max(0, rect.width - cfg.gap);
    const height = Math.max(0, rect.height - cfg.gap);

    const item = sorted.find((i) => i.id === rect.id);
    const areaFraction = item ? item.value / maxArea : 0;

    cells.set(rect.id, {
      id: rect.id,
      x,
      y,
      width,
      height,
      areaFraction,
    });
  }

  return {
    cells,
    totalWidth: cfg.width,
    totalHeight: cfg.height,
  };
}

// ============================================================================
// Squarify Algorithm
// ============================================================================

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ItemArea {
  id: string;
  area: number;
}

interface LayoutRect extends Rect {
  id: string;
}

/**
 * Squarify algorithm: recursively partition a rectangle into sub-rectangles
 * with aspect ratios as close to 1:1 as possible.
 */
function squarify(items: ItemArea[], bounds: Rect): LayoutRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ id: items[0].id, ...bounds }];
  }

  // Determine the shorter side of the remaining rectangle
  const shortSide = Math.min(bounds.width, bounds.height);
  if (shortSide <= 0) {
    // Degenerate case — assign zero-size rects
    return items.map((item) => ({
      id: item.id,
      x: bounds.x,
      y: bounds.y,
      width: 0,
      height: 0,
    }));
  }

  // Greedily build a row: keep adding items while the worst aspect ratio improves
  const row: ItemArea[] = [items[0]];
  let remaining = items.slice(1);

  let currentWorst = worstAspectRatio(row, shortSide);

  while (remaining.length > 0) {
    const candidate = [...row, remaining[0]];
    const candidateWorst = worstAspectRatio(candidate, shortSide);

    if (candidateWorst <= currentWorst) {
      row.push(remaining[0]);
      remaining = remaining.slice(1);
      currentWorst = candidateWorst;
    } else {
      break;
    }
  }

  // Layout the current row
  const { rects, remainingBounds } = layoutRow(row, bounds);

  // Recurse for remaining items
  return [...rects, ...squarify(remaining, remainingBounds)];
}

/**
 * Calculate the worst aspect ratio for a set of items laid out
 * along a strip with the given fixed side length.
 */
function worstAspectRatio(items: ItemArea[], sideLength: number): number {
  if (items.length === 0 || sideLength <= 0) return Infinity;

  const totalArea = items.reduce((sum, item) => sum + item.area, 0);
  const stripLength = totalArea / sideLength;

  let worst = 0;
  for (const item of items) {
    const itemLength = item.area / stripLength;
    const ratio = Math.max(sideLength / itemLength, itemLength / sideLength);
    worst = Math.max(worst, ratio);
  }

  return worst;
}

/**
 * Layout a row of items along the shorter side of the bounding rectangle.
 * Returns the positioned rectangles and the remaining bounds.
 */
function layoutRow(
  row: ItemArea[],
  bounds: Rect
): { rects: LayoutRect[]; remainingBounds: Rect } {
  const totalArea = row.reduce((sum, item) => sum + item.area, 0);
  const isHorizontal = bounds.width >= bounds.height;

  const rects: LayoutRect[] = [];

  if (isHorizontal) {
    // Layout as a vertical strip on the left
    const stripWidth = totalArea / bounds.height;
    let y = bounds.y;

    for (const item of row) {
      const height = item.area / stripWidth;
      rects.push({
        id: item.id,
        x: bounds.x,
        y,
        width: stripWidth,
        height,
      });
      y += height;
    }

    return {
      rects,
      remainingBounds: {
        x: bounds.x + stripWidth,
        y: bounds.y,
        width: bounds.width - stripWidth,
        height: bounds.height,
      },
    };
  } else {
    // Layout as a horizontal strip on the top
    const stripHeight = totalArea / bounds.width;
    let x = bounds.x;

    for (const item of row) {
      const width = item.area / stripHeight;
      rects.push({
        id: item.id,
        x,
        y: bounds.y,
        width,
        height: stripHeight,
      });
      x += width;
    }

    return {
      rects,
      remainingBounds: {
        x: bounds.x,
        y: bounds.y + stripHeight,
        width: bounds.width,
        height: bounds.height - stripHeight,
      },
    };
  }
}

// ============================================================================
// Helpers
// ============================================================================

function resolveConfig(config?: Partial<TreemapLayoutConfig>): Required<TreemapLayoutConfig> {
  return {
    width: config?.width ?? DEFAULT_CONFIG.width,
    height: config?.height ?? DEFAULT_CONFIG.height,
    gap: config?.gap ?? DEFAULT_CONFIG.gap,
    minLabelDimension: config?.minLabelDimension ?? DEFAULT_CONFIG.minLabelDimension,
  };
}

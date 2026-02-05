/**
 * Tests for Mosaic Layout Calculator - Skyline Bin-Packing Algorithm
 *
 * Tests tile positioning with variable-sized rectangles using bin-packing.
 */

import { describe, it, expect } from "vitest";
import {
  calculateMosaicLayout,
  calculateBucket,
  calculateBuckets,
  groupTilesByRow,
  getBucketHeight,
} from "./mosaic-layout";
import type { LayoutItem } from "./types";

// ============================================================================
// Test Helpers
// ============================================================================

function createItems(counts: number[]): LayoutItem[] {
  return counts.map((count, i) => ({
    id: `item-${i + 1}`,
    count,
  }));
}

function createItemsWithLabels(items: Array<{ count: number; label: string }>): LayoutItem[] {
  return items.map((item, i) => ({
    id: `item-${i + 1}`,
    count: item.count,
    label: item.label,
  }));
}

// ============================================================================
// Bucket Calculation Tests
// ============================================================================

describe("calculateBucket", () => {
  it("returns md for empty sorted counts", () => {
    expect(calculateBucket(10, [])).toBe("md");
  });

  it("returns xl for top 10%", () => {
    const sortedCounts = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
    expect(calculateBucket(100, sortedCounts)).toBe("xl");
  });

  it("returns lg for 10-30%", () => {
    const sortedCounts = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
    expect(calculateBucket(80, sortedCounts)).toBe("lg");
  });

  it("returns md for 30-60%", () => {
    const sortedCounts = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
    expect(calculateBucket(50, sortedCounts)).toBe("md");
  });

  it("returns sm for 60-85%", () => {
    const sortedCounts = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
    expect(calculateBucket(30, sortedCounts)).toBe("sm");
  });

  it("returns xs for bottom 15%", () => {
    const sortedCounts = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
    expect(calculateBucket(10, sortedCounts)).toBe("xs");
  });
});

describe("calculateBuckets", () => {
  it("returns empty map for empty items", () => {
    const buckets = calculateBuckets([]);
    expect(buckets.size).toBe(0);
  });

  it("assigns buckets based on relative counts", () => {
    const items = createItems([100, 95, 90, 85, 80, 75, 70, 65, 60, 55]);
    const buckets = calculateBuckets(items);

    expect(buckets.get("item-1")).toBe("xl");
    expect(buckets.get("item-10")).toBe("xs");
  });

  it("assigns xl to single item (top percentile)", () => {
    const items = createItems([50]);
    const buckets = calculateBuckets(items);
    expect(buckets.get("item-1")).toBe("xl");
  });
});

describe("getBucketHeight", () => {
  it("returns correct height for each bucket", () => {
    expect(getBucketHeight("xs")).toBe(115);
    expect(getBucketHeight("sm")).toBe(140);
    expect(getBucketHeight("md")).toBe(185);
    expect(getBucketHeight("lg")).toBe(240);
    expect(getBucketHeight("xl")).toBe(280);
  });
});

// ============================================================================
// Empty Layout Tests
// ============================================================================

describe("calculateMosaicLayout - empty", () => {
  it("returns empty result for no items", () => {
    const result = calculateMosaicLayout([]);

    expect(result.tiles.size).toBe(0);
    expect(result.rowCount).toBe(0);
    expect(result.columnCount).toBe(0);
    expect(result.pattern).toBe("grid");
    expect(result.totalHeight).toBe(0);
  });
});

// ============================================================================
// Single Item Layout Tests
// ============================================================================

describe("calculateMosaicLayout - single item", () => {
  it("uses single pattern for one item", () => {
    const items = createItems([50]);
    const result = calculateMosaicLayout(items);

    expect(result.pattern).toBe("single");
    expect(result.tiles.size).toBe(1);
  });

  it("positions single item at origin", () => {
    const items = createItems([50]);
    const result = calculateMosaicLayout(items);
    const layout = result.tiles.get("item-1");

    expect(layout).toBeDefined();
    expect(layout!.x).toBe(0);
    expect(layout!.y).toBe(0);
  });

  it("single item has dimensions within constraints", () => {
    const items = createItems([50]);
    const result = calculateMosaicLayout(items);
    const layout = result.tiles.get("item-1");

    const width = parseFloat(layout!.width);
    expect(width).toBeGreaterThanOrEqual(100);
    expect(width).toBeLessThanOrEqual(320);
    expect(layout!.height).toBeGreaterThanOrEqual(80);
    expect(layout!.height).toBeLessThanOrEqual(280);
  });
});

// ============================================================================
// Pair Layout Tests
// ============================================================================

describe("calculateMosaicLayout - pair", () => {
  it("uses pair pattern for two items", () => {
    const items = createItems([50, 40]);
    const result = calculateMosaicLayout(items);

    expect(result.pattern).toBe("pair");
  });

  it("places both tiles at y=0 when they fit side by side", () => {
    const items = createItems([50, 40]);
    const result = calculateMosaicLayout(items, { availableWidth: 500 });

    const first = result.tiles.get("item-1");
    const second = result.tiles.get("item-2");

    // Tallest tile is placed first, so both should start at y=0
    expect(first!.y).toBe(0);
    expect(second!.y).toBe(0);
  });
});

// ============================================================================
// Bin-Packing Tests
// ============================================================================

describe("calculateMosaicLayout - bin packing", () => {
  it("fills vertical gaps efficiently", () => {
    const items = createItems([100, 80, 60, 40, 20, 10, 5, 3]);
    const result = calculateMosaicLayout(items, { availableWidth: 500 });

    expect(result.tiles.size).toBe(8);

    for (const [, layout] of result.tiles) {
      expect(layout.x).toBeGreaterThanOrEqual(0);
      expect(layout.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("places taller items first (sorted by height)", () => {
    const items = [
      { id: "small", count: 10 },
      { id: "large", count: 100 },
    ];
    const result = calculateMosaicLayout(items);

    const large = result.tiles.get("large");

    // Large item should be at top (y=0) because it's taller
    expect(large!.y).toBe(0);
  });

  it("calculates total height correctly", () => {
    const items = createItems([100, 50, 25]);
    const result = calculateMosaicLayout(items);

    expect(result.totalHeight).toBeGreaterThan(0);
  });

  it("tiles do not overlap", () => {
    const items = createItems([100, 80, 60, 40, 20, 10]);
    const result = calculateMosaicLayout(items, { availableWidth: 500 });

    const tiles = Array.from(result.tiles.values());

    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        const a = tiles[i];
        const b = tiles[j];

        const aWidth = parseFloat(a.width);
        const bWidth = parseFloat(b.width);

        // Check if rectangles overlap
        const xOverlap = a.x < b.x + bWidth && a.x + aWidth > b.x;
        const yOverlap = a.y < b.y + b.height && a.y + a.height > b.y;

        // Should not both overlap
        expect(xOverlap && yOverlap).toBe(false);
      }
    }
  });
});

// ============================================================================
// Dimension Tests
// ============================================================================

describe("calculateMosaicLayout - dimensions", () => {
  it("tiles with higher counts have larger area", () => {
    const items = createItems([100, 10]);
    const result = calculateMosaicLayout(items);

    const highCount = result.tiles.get("item-1");
    const lowCount = result.tiles.get("item-2");

    const highArea = parseFloat(highCount!.width) * highCount!.height;
    const lowArea = parseFloat(lowCount!.width) * lowCount!.height;

    expect(highArea).toBeGreaterThan(lowArea);
  });

  it("tiles have heights between MIN and MAX", () => {
    const items = createItems([1000, 500, 100, 10, 1]);
    const result = calculateMosaicLayout(items);

    for (const [, layout] of result.tiles) {
      expect(layout.height).toBeGreaterThanOrEqual(80);  // minTileHeight
      expect(layout.height).toBeLessThanOrEqual(280);    // maxTileHeight
    }
  });

  it("tiles have widths between MIN and MAX", () => {
    const items = createItems([1000, 500, 100, 10, 1]);
    const result = calculateMosaicLayout(items);

    for (const [, layout] of result.tiles) {
      const width = parseFloat(layout.width);
      expect(width).toBeGreaterThanOrEqual(100);  // minTileWidth
      expect(width).toBeLessThanOrEqual(320);     // maxTileWidth
    }
  });

  it("uses log scaling for area (prevents extreme size differences)", () => {
    // With linear scaling, 1000000 vs 1 would have 1000000x area difference
    // With log scaling, the difference is much smaller
    const items = createItems([1000000, 1]);
    const result = calculateMosaicLayout(items);

    const large = result.tiles.get("item-1");
    const small = result.tiles.get("item-2");

    const largeArea = parseFloat(large!.width) * large!.height;
    const smallArea = parseFloat(small!.width) * small!.height;

    // Ratio should be much less than 1000000 (log scaling limits it)
    expect(largeArea / smallArea).toBeLessThan(10);
  });
});

// ============================================================================
// Absolute Positioning Tests
// ============================================================================

describe("calculateMosaicLayout - absolute positioning", () => {
  it("provides x, y, height for each tile", () => {
    const items = createItems([50, 40, 30]);
    const result = calculateMosaicLayout(items);

    for (const [, layout] of result.tiles) {
      expect(typeof layout.x).toBe("number");
      expect(typeof layout.y).toBe("number");
      expect(typeof layout.height).toBe("number");
      expect(layout.height).toBeGreaterThan(0);
    }
  });

  it("all tiles fit within container width", () => {
    const items = createItems([100, 80, 60, 40, 20, 10]);
    const containerWidth = 500;
    const result = calculateMosaicLayout(items, { availableWidth: containerWidth });

    for (const [, layout] of result.tiles) {
      const tileRight = layout.x + parseFloat(layout.width);
      expect(tileRight).toBeLessThanOrEqual(containerWidth);
    }
  });
});

// ============================================================================
// groupTilesByRow Tests
// ============================================================================

describe("groupTilesByRow", () => {
  it("returns empty array for empty items", () => {
    const layout = calculateMosaicLayout([]);
    const rows = groupTilesByRow([], layout);

    expect(rows.length).toBe(0);
  });

  it("returns all items sorted by position", () => {
    const items = createItems([50, 40, 30, 20]);
    const layout = calculateMosaicLayout(items);
    const rows = groupTilesByRow(items, layout);

    expect(rows.length).toBe(1);
    expect(rows[0].length).toBe(4);
  });

  it("sorts items by y then x position", () => {
    const items = createItems([100, 50, 25, 10]);
    const layout = calculateMosaicLayout(items, { availableWidth: 500 });
    const rows = groupTilesByRow(items, layout);

    const sorted = rows[0];
    for (let i = 1; i < sorted.length; i++) {
      const prev = layout.tiles.get(sorted[i - 1].id);
      const curr = layout.tiles.get(sorted[i].id);

      if (prev && curr) {
        const yDiff = curr.y - prev.y;
        if (Math.abs(yDiff) > 10) {
          expect(yDiff).toBeGreaterThanOrEqual(0);
        } else {
          expect(curr.x).toBeGreaterThanOrEqual(prev.x);
        }
      }
    }
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("edge cases", () => {
  it("handles items with zero counts", () => {
    const items = createItems([0, 0, 0]);
    const result = calculateMosaicLayout(items);

    expect(result.tiles.size).toBe(3);
    expect(result.pattern).toBe("trio");
  });

  it("handles items with equal counts", () => {
    const items = createItems([50, 50, 50, 50]);
    const result = calculateMosaicLayout(items);

    expect(result.tiles.size).toBe(4);
    expect(result.pattern).toBe("quad");
  });

  it("handles very large count differences", () => {
    const items = createItems([1000000, 1]);
    const result = calculateMosaicLayout(items);

    expect(result.pattern).toBe("pair");
    expect(result.tiles.size).toBe(2);
  });

  it("respects custom gap in layout", () => {
    const items = createItems([100, 50, 50, 50, 50, 50]);
    const result = calculateMosaicLayout(items, { gap: 24, availableWidth: 500 });

    expect(result.tiles.size).toBe(6);
    expect(result.totalHeight).toBeGreaterThan(0);
  });

  it("handles many items efficiently", () => {
    const items = createItems(Array(50).fill(0).map((_, i) => 100 - i));
    const result = calculateMosaicLayout(items);

    expect(result.tiles.size).toBe(50);
    expect(result.totalHeight).toBeGreaterThan(0);
  });
});

// ============================================================================
// Label-Based Aspect Ratio Tests
// ============================================================================

describe("calculateMosaicLayout - label-based dimensions", () => {
  it("gives wider tiles to items with long labels", () => {
    const items = createItemsWithLabels([
      { count: 50, label: "short" },
      { count: 50, label: "this-is-a-very-long-label-name" },
    ]);
    const result = calculateMosaicLayout(items, { availableWidth: 500 });

    const shortLabel = result.tiles.get("item-1");
    const longLabel = result.tiles.get("item-2");

    // Long label should have wider tile (higher aspect ratio)
    expect(parseFloat(longLabel!.width)).toBeGreaterThan(parseFloat(shortLabel!.width));
  });

  it("short labels get square-ish tiles", () => {
    const items = createItemsWithLabels([
      { count: 50, label: "short" },
    ]);
    const result = calculateMosaicLayout(items, { availableWidth: 500 });

    const tile = result.tiles.get("item-1");
    const width = parseFloat(tile!.width);
    const height = tile!.height;
    const aspectRatio = width / height;

    // Should be close to 1:1 (square)
    expect(aspectRatio).toBeGreaterThan(0.7);
    expect(aspectRatio).toBeLessThan(1.5);
  });

  it("long labels get landscape tiles", () => {
    const items = createItemsWithLabels([
      { count: 50, label: "this-is-a-very-long-label-that-needs-more-width" },
    ]);
    const result = calculateMosaicLayout(items, { availableWidth: 500 });

    const tile = result.tiles.get("item-1");
    const width = parseFloat(tile!.width);
    const height = tile!.height;
    const aspectRatio = width / height;

    // Should be landscape (width > height)
    expect(aspectRatio).toBeGreaterThan(1.5);
  });

  it("tiles without labels behave like short labels", () => {
    const items = createItems([50, 50]);
    const result = calculateMosaicLayout(items, { availableWidth: 500 });

    const tile1 = result.tiles.get("item-1");
    const tile2 = result.tiles.get("item-2");

    const width1 = parseFloat(tile1!.width);
    const width2 = parseFloat(tile2!.width);

    // Both should have similar width (no label = default aspect ratio)
    expect(Math.abs(width1 - width2)).toBeLessThan(1);
  });

  it("maintains reasonable surface area for tiles with same count but different widths", () => {
    const items = createItemsWithLabels([
      { count: 100, label: "short" },
      { count: 100, label: "no-mixed-components-allowed-here" },
    ]);
    const result = calculateMosaicLayout(items, { availableWidth: 500 });

    const shortLabel = result.tiles.get("item-1");
    const longLabel = result.tiles.get("item-2");

    const shortArea = parseFloat(shortLabel!.width) * shortLabel!.height;
    const longArea = parseFloat(longLabel!.width) * longLabel!.height;

    // Areas should be roughly similar (within 50% tolerance due to constraints)
    expect(Math.abs(shortArea - longArea) / shortArea).toBeLessThan(0.5);
  });
});

// ============================================================================
// Padding Tests
// ============================================================================

describe("calculateMosaicLayout - padding", () => {
  it("applies padding offsets to tile positions", () => {
    const items = createItems([50]);
    const result = calculateMosaicLayout(items, {
      padding: { top: 10, left: 20 },
    });

    const tile = result.tiles.get("item-1");
    expect(tile!.x).toBe(20);
    expect(tile!.y).toBe(10);
  });

  it("includes padding in total height", () => {
    const items = createItems([50]);
    const resultNoPadding = calculateMosaicLayout(items);
    const resultWithPadding = calculateMosaicLayout(items, {
      padding: { top: 10, bottom: 20 },
    });

    expect(resultWithPadding.totalHeight).toBe(resultNoPadding.totalHeight + 30);
  });
});

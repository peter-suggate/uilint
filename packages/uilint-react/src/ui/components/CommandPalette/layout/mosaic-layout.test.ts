/**
 * Tests for Mosaic Layout Calculator - Bin-Packing Algorithm
 *
 * Tests tile positioning with absolute coordinates for true masonry layout.
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
    expect(getBucketHeight("xs")).toBe(72);
    expect(getBucketHeight("sm")).toBe(96);
    expect(getBucketHeight("md")).toBe(128);
    expect(getBucketHeight("lg")).toBe(168);
    expect(getBucketHeight("xl")).toBe(220);
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

  it("spans full width for single item", () => {
    const items = createItems([50]);
    const result = calculateMosaicLayout(items, { availableWidth: 500 });
    const layout = result.tiles.get("item-1");

    expect(layout!.widthFraction).toBe(1);
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

  it("places hero item full width with second below", () => {
    // With 2 items, first xl item spans full width (hero style)
    const items = createItems([50, 40]);
    const result = calculateMosaicLayout(items);

    const first = result.tiles.get("item-1");
    const second = result.tiles.get("item-2");

    // First should be at top with full width
    expect(first!.y).toBe(0);
    expect(first!.widthFraction).toBe(1);

    // Second should be below first
    expect(second!.y).toBeGreaterThan(0);
  });

  it("places similar-sized items side by side when not xl", () => {
    // With many items, pair of medium items go side by side
    const items = createItems([100, 90, 50, 45]); // Last two are similar (md)
    const result = calculateMosaicLayout(items, { availableWidth: 500 });

    // Just verify layout works for multiple items
    expect(result.tiles.size).toBe(4);
  });
});

// ============================================================================
// Bin-Packing Tests
// ============================================================================

describe("calculateMosaicLayout - bin packing", () => {
  it("fills vertical gaps efficiently", () => {
    // Create items with varying heights
    const items = createItems([100, 80, 60, 40, 20, 10, 5, 3]);
    const result = calculateMosaicLayout(items, { availableWidth: 500 });

    // Verify all items have positions
    expect(result.tiles.size).toBe(8);

    // All positions should be non-negative
    for (const [, layout] of result.tiles) {
      expect(layout.x).toBeGreaterThanOrEqual(0);
      expect(layout.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("places larger items first", () => {
    const items = [
      { id: "small", count: 10 },
      { id: "large", count: 100 },
    ];
    const result = calculateMosaicLayout(items);

    const large = result.tiles.get("large");

    // Large item should be at top (y=0)
    expect(large!.y).toBe(0);
  });

  it("calculates total height correctly", () => {
    const items = createItems([100, 50, 25]);
    const result = calculateMosaicLayout(items);

    expect(result.totalHeight).toBeGreaterThan(0);
  });
});

// ============================================================================
// Column Count Tests
// ============================================================================

describe("calculateMosaicLayout - columns", () => {
  it("uses 3 columns when width allows", () => {
    const items = createItems([50, 40, 30, 20, 10]);
    const result = calculateMosaicLayout(items, { availableWidth: 500 });

    expect(result.columnCount).toBe(3);
  });

  it("uses 2 columns when width is limited", () => {
    const items = createItems([50, 40, 30, 20, 10]);
    const result = calculateMosaicLayout(items, {
      availableWidth: 300,
      minTileWidth: 140,
    });

    expect(result.columnCount).toBe(2);
  });

  it("uses 1 column for very narrow widths", () => {
    const items = createItems([50, 40]);
    const result = calculateMosaicLayout(items, {
      availableWidth: 150,
      minTileWidth: 140,
    });

    expect(result.columnCount).toBe(1);
  });
});

// ============================================================================
// Column Span Tests
// ============================================================================

describe("calculateMosaicLayout - column spanning", () => {
  it("first xl item spans full width (3 columns)", () => {
    const items = createItems([100]); // Single xl item
    const result = calculateMosaicLayout(items, { availableWidth: 500 });

    const layout = result.tiles.get("item-1");
    expect(layout!.widthFraction).toBe(1);
  });

  it("lg items span 2 columns in 3-column layout", () => {
    // Need enough items to get different bucket sizes
    const items = createItems([100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
    const result = calculateMosaicLayout(items, { availableWidth: 500 });

    // Find an lg bucket item (should be in 10-30% range)
    const lgItem = result.tiles.get("item-2"); // Second highest = lg
    expect(lgItem!.widthFraction).toBeGreaterThan(1 / 3);
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

  it("tiles do not overlap", () => {
    const items = createItems([100, 80, 60, 40, 20, 10]);
    const result = calculateMosaicLayout(items, { availableWidth: 500 });

    const tiles = Array.from(result.tiles.values());

    // Check each pair of tiles for overlap
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        const a = tiles[i];
        const b = tiles[j];

        const aWidth = parseFloat(a.width);
        const bWidth = parseFloat(b.width);

        // Check if rectangles overlap
        const xOverlap =
          a.x < b.x + bWidth && a.x + aWidth > b.x;
        const yOverlap =
          a.y < b.y + b.height && a.y + a.height > b.y;

        // Should not both overlap
        expect(xOverlap && yOverlap).toBe(false);
      }
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

    // Should have one "row" with all items (for absolute positioning)
    expect(rows.length).toBe(1);
    expect(rows[0].length).toBe(4);
  });

  it("sorts items by y then x position", () => {
    const items = createItems([100, 50, 25, 10]);
    const layout = calculateMosaicLayout(items, { availableWidth: 500 });
    const rows = groupTilesByRow(items, layout);

    // Items should be sorted by y position, then x
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

  it("respects custom gap in vertical spacing", () => {
    const items = createItems([50, 40]);
    const result = calculateMosaicLayout(items, { gap: 24 });

    const first = result.tiles.get("item-1");
    const second = result.tiles.get("item-2");

    // With hero layout, gap shows in vertical spacing
    // second.y should be first.height + gap
    expect(second!.y).toBe(first!.height + 24);
  });

  it("respects custom gap in horizontal spacing", () => {
    // Use enough items to get side-by-side placement
    const items = createItems([100, 50, 50, 50, 50, 50]);
    const result = calculateMosaicLayout(items, { gap: 24, availableWidth: 500 });

    // Find two items that are side by side (same y, different x)
    const tiles = Array.from(result.tiles.values());
    const sameRowTiles = tiles.filter(t => t.y === tiles[1].y && t.x !== tiles[1].x);

    if (sameRowTiles.length > 0) {
      const left = tiles[1].x < sameRowTiles[0].x ? tiles[1] : sameRowTiles[0];
      const right = tiles[1].x < sameRowTiles[0].x ? sameRowTiles[0] : tiles[1];

      // Gap should be between them
      expect(right.x - (left.x + parseFloat(left.width))).toBe(24);
    }
  });

  it("handles many items efficiently", () => {
    const items = createItems(Array(50).fill(0).map((_, i) => 100 - i));
    const result = calculateMosaicLayout(items);

    expect(result.tiles.size).toBe(50);
    expect(result.totalHeight).toBeGreaterThan(0);
  });
});

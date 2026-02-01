/**
 * Tests for Mosaic Layout Calculator
 *
 * Tests tile positioning for special layouts (1-4 items) and grid layouts (5+ items).
 */

import { describe, it, expect } from "vitest";
import {
  calculateMosaicLayout,
  calculateBucket,
  calculateBuckets,
  groupTilesByRow,
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
    // With 10 items, each represents 10% of the distribution
    const items = createItems([100, 95, 90, 85, 80, 75, 70, 65, 60, 55]);
    const buckets = calculateBuckets(items);

    expect(buckets.get("item-1")).toBe("xl");  // Position 0/10 = 0% → xl
    expect(buckets.get("item-10")).toBe("xs"); // Position 9/10 = 90% → xs
  });

  it("assigns xl to single item (top percentile)", () => {
    // Single item is at position 0/1 = 0%, which is top 10% → xl
    const items = createItems([50]);
    const buckets = calculateBuckets(items);
    expect(buckets.get("item-1")).toBe("xl");
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
  });
});

// ============================================================================
// Single Item (Hero) Layout Tests
// ============================================================================

describe("calculateMosaicLayout - single item (hero)", () => {
  it("uses single pattern for one item", () => {
    const items = createItems([50]);
    const result = calculateMosaicLayout(items);

    expect(result.pattern).toBe("single");
    expect(result.rowCount).toBe(1);
    expect(result.columnCount).toBe(1);
  });

  it("creates full-width xl tile", () => {
    const items = createItems([50]);
    const result = calculateMosaicLayout(items);
    const layout = result.tiles.get("item-1");

    expect(layout).toBeDefined();
    expect(layout!.width).toBe("100%");
    expect(layout!.widthFraction).toBe(1);
    expect(layout!.bucket).toBe("xl");
    expect(layout!.isRowStart).toBe(true);
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
    expect(result.rowCount).toBe(1);
    expect(result.columnCount).toBe(2);
  });

  it("creates 50/50 split for similar counts", () => {
    const items = createItems([50, 45]);
    const result = calculateMosaicLayout(items);

    const first = result.tiles.get("item-1");
    const second = result.tiles.get("item-2");

    expect(first!.widthFraction).toBe(0.5);
    expect(second!.widthFraction).toBe(0.5);
  });

  it("creates 60/40 split for moderately different counts", () => {
    const items = createItems([70, 30]); // 70% ratio
    const result = calculateMosaicLayout(items);

    const first = result.tiles.get("item-1");
    const second = result.tiles.get("item-2");

    expect(first!.widthFraction).toBe(0.6);
    expect(second!.widthFraction).toBe(0.4);
  });

  it("creates 65/35 split for very different counts", () => {
    const items = createItems([90, 10]); // 90% ratio
    const result = calculateMosaicLayout(items);

    const first = result.tiles.get("item-1");
    const second = result.tiles.get("item-2");

    expect(first!.widthFraction).toBe(0.65);
    expect(second!.widthFraction).toBe(0.35);
  });

  it("puts larger count first regardless of input order", () => {
    const items = [
      { id: "small", count: 10 },
      { id: "large", count: 100 },
    ];
    const result = calculateMosaicLayout(items);

    const large = result.tiles.get("large");
    const small = result.tiles.get("small");

    expect(large!.column).toBe(0);
    expect(small!.column).toBe(1);
  });

  it("marks first tile as row start", () => {
    const items = createItems([50, 40]);
    const result = calculateMosaicLayout(items);

    const first = result.tiles.get("item-1");
    const second = result.tiles.get("item-2");

    expect(first!.isRowStart).toBe(true);
    expect(second!.isRowStart).toBe(false);
  });
});

// ============================================================================
// Trio Layout Tests
// ============================================================================

describe("calculateMosaicLayout - trio", () => {
  it("uses trio pattern for three items", () => {
    const items = createItems([50, 40, 30]);
    const result = calculateMosaicLayout(items);

    expect(result.pattern).toBe("trio");
  });

  it("uses featured layout when first item is dominant", () => {
    // First item is 2x the average of others (60 >= (20+10)/2 * 2 = 30)
    const items = createItems([60, 20, 10]);
    const result = calculateMosaicLayout(items);

    expect(result.rowCount).toBe(2);
    expect(result.columnCount).toBe(2);

    const first = result.tiles.get("item-1");
    expect(first!.row).toBe(0);
    expect(first!.widthFraction).toBe(1);
    expect(first!.bucket).toBe("xl");
  });

  it("uses equal layout when counts are similar", () => {
    const items = createItems([50, 45, 40]);
    const result = calculateMosaicLayout(items);

    expect(result.rowCount).toBe(1);
    expect(result.columnCount).toBe(3);

    const first = result.tiles.get("item-1");
    expect(first!.widthFraction).toBeCloseTo(1 / 3, 2);
  });

  it("places second two items in row 1 for featured layout", () => {
    const items = createItems([100, 20, 10]);
    const result = calculateMosaicLayout(items);

    const second = result.tiles.get("item-2");
    const third = result.tiles.get("item-3");

    expect(second!.row).toBe(1);
    expect(third!.row).toBe(1);
    expect(second!.column).toBe(0);
    expect(third!.column).toBe(1);
  });
});

// ============================================================================
// Quad Layout Tests
// ============================================================================

describe("calculateMosaicLayout - quad", () => {
  it("uses quad pattern for four items", () => {
    const items = createItems([50, 40, 30, 20]);
    const result = calculateMosaicLayout(items);

    expect(result.pattern).toBe("quad");
    expect(result.rowCount).toBe(2);
    expect(result.columnCount).toBe(2);
  });

  it("creates 2x2 grid", () => {
    const items = createItems([50, 40, 30, 20]);
    const result = calculateMosaicLayout(items);

    // Sorted by count: item-1 (50), item-2 (40), item-3 (30), item-4 (20)
    const item1 = result.tiles.get("item-1");
    const item2 = result.tiles.get("item-2");
    const item3 = result.tiles.get("item-3");
    const item4 = result.tiles.get("item-4");

    expect(item1!.row).toBe(0);
    expect(item1!.column).toBe(0);
    expect(item2!.row).toBe(0);
    expect(item2!.column).toBe(1);
    expect(item3!.row).toBe(1);
    expect(item3!.column).toBe(0);
    expect(item4!.row).toBe(1);
    expect(item4!.column).toBe(1);
  });

  it("gives all tiles 50% width", () => {
    const items = createItems([50, 40, 30, 20]);
    const result = calculateMosaicLayout(items);

    for (const [, layout] of result.tiles) {
      expect(layout.widthFraction).toBe(0.5);
    }
  });
});

// ============================================================================
// Grid Layout Tests (5+ items)
// ============================================================================

describe("calculateMosaicLayout - grid", () => {
  it("uses grid pattern for 5+ items", () => {
    const items = createItems([50, 40, 30, 20, 10]);
    const result = calculateMosaicLayout(items);

    expect(result.pattern).toBe("grid");
  });

  it("uses 3 columns when width allows", () => {
    const items = createItems([50, 40, 30, 20, 10, 5]);
    const result = calculateMosaicLayout(items, { availableWidth: 500 });

    expect(result.columnCount).toBe(3);
  });

  it("uses 2 columns when width is limited", () => {
    const items = createItems([50, 40, 30, 20, 10]);
    // With 300px width and 12px gap, 3 columns = (300 - 24) / 3 = 92px < 140px min
    const result = calculateMosaicLayout(items, {
      availableWidth: 300,
      minTileWidth: 140,
    });

    expect(result.columnCount).toBe(2);
  });

  it("calculates correct row count", () => {
    const items = createItems([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const result = calculateMosaicLayout(items, { availableWidth: 500 });

    // 10 items / 3 columns = 4 rows (rounded up)
    expect(result.rowCount).toBe(4);
  });

  it("assigns tiles to correct positions", () => {
    const items = createItems([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    const result = calculateMosaicLayout(items, { availableWidth: 500 });

    // Items are sorted by count, so first 3 go to row 0, next 3 to row 1, etc.
    const item1 = result.tiles.get("item-1"); // count 9, sorted to position 0
    const item4 = result.tiles.get("item-4"); // count 6, sorted to position 3

    expect(item1!.row).toBe(0);
    expect(item1!.column).toBe(0);
    expect(item4!.row).toBe(1);
    expect(item4!.column).toBe(0);
  });
});

// ============================================================================
// Width Calculation Tests
// ============================================================================

describe("width calculations", () => {
  it("includes gap in width calculation", () => {
    const items = createItems([50, 50]);
    const result = calculateMosaicLayout(items, { gap: 12 });

    const layout = result.tiles.get("item-1");
    // 50% width with 12px gap adjustment
    expect(layout!.width).toContain("calc");
    expect(layout!.width).toContain("50.0%");
  });

  it("uses 100% for full-width tiles", () => {
    const items = createItems([50]);
    const result = calculateMosaicLayout(items);

    const layout = result.tiles.get("item-1");
    expect(layout!.width).toBe("100%");
  });
});

// ============================================================================
// groupTilesByRow Tests
// ============================================================================

describe("groupTilesByRow", () => {
  it("groups tiles by their row", () => {
    const items = createItems([50, 40, 30, 20]);
    const layout = calculateMosaicLayout(items);
    const rows = groupTilesByRow(items, layout);

    expect(rows.length).toBe(2);
    expect(rows[0].length).toBe(2);
    expect(rows[1].length).toBe(2);
  });

  it("sorts tiles within row by column", () => {
    const items = [
      { id: "c", count: 30 },
      { id: "a", count: 50 },
      { id: "b", count: 40 },
      { id: "d", count: 20 },
    ];
    const layout = calculateMosaicLayout(items);
    const rows = groupTilesByRow(items, layout);

    // First row should have highest counts in column order
    expect(rows[0][0].id).toBe("a"); // 50, column 0
    expect(rows[0][1].id).toBe("b"); // 40, column 1
  });

  it("returns empty rows for empty layout", () => {
    const layout = calculateMosaicLayout([]);
    const rows = groupTilesByRow([], layout);

    expect(rows.length).toBe(0);
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
    const first = result.tiles.get("item-1");
    expect(first!.widthFraction).toBe(0.65); // Very dominant
  });

  it("respects custom minTileWidth", () => {
    const items = createItems([1, 2, 3, 4, 5]);
    const result = calculateMosaicLayout(items, {
      availableWidth: 500,
      minTileWidth: 200,
    });

    // With 500px and 200px min, only 2 columns fit
    expect(result.columnCount).toBe(2);
  });

  it("respects custom gap", () => {
    const items = createItems([50, 50]);
    const result = calculateMosaicLayout(items, { gap: 24 });

    const layout = result.tiles.get("item-1");
    expect(layout!.width).toContain("24px");
  });
});

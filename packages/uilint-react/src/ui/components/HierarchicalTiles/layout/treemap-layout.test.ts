/**
 * Tests for Squarified Treemap Layout Algorithm
 *
 * Verifies the treemap produces correct, non-overlapping, space-filling layouts
 * with squarified aspect ratios.
 */

import { describe, it, expect } from "vitest";
import { calculateTreemapLayout, type TreemapItem } from "./treemap-layout";
import type { TreemapCellLayout } from "./types";

// ============================================================================
// Test Helpers
// ============================================================================

function createItems(values: number[]): TreemapItem[] {
  return values.map((value, i) => ({
    id: `item-${i + 1}`,
    value,
  }));
}

function createNamedItems(entries: Array<{ id: string; value: number }>): TreemapItem[] {
  return entries.map((e) => ({ id: e.id, value: e.value }));
}

/** Check that no two cells overlap */
function assertNoOverlaps(cells: TreemapCellLayout[]) {
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i];
      const b = cells[j];
      const overlapsX = a.x < b.x + b.width && a.x + a.width > b.x;
      const overlapsY = a.y < b.y + b.height && a.y + a.height > b.y;
      expect(
        overlapsX && overlapsY,
        `Cells ${a.id} and ${b.id} overlap: ` +
          `A(${a.x},${a.y},${a.width},${a.height}) B(${b.x},${b.y},${b.width},${b.height})`
      ).toBe(false);
    }
  }
}

/** Check that all cells are within the bounding rectangle */
function assertWithinBounds(
  cells: TreemapCellLayout[],
  width: number,
  height: number
) {
  for (const cell of cells) {
    expect(cell.x).toBeGreaterThanOrEqual(0);
    expect(cell.y).toBeGreaterThanOrEqual(0);
    expect(cell.x + cell.width).toBeLessThanOrEqual(width + 0.01); // float tolerance
    expect(cell.y + cell.height).toBeLessThanOrEqual(height + 0.01);
  }
}

/** Get aspect ratio of a cell (always >= 1) */
function aspectRatio(cell: TreemapCellLayout): number {
  if (cell.width === 0 || cell.height === 0) return Infinity;
  return Math.max(cell.width / cell.height, cell.height / cell.width);
}

// ============================================================================
// Empty and Edge Cases
// ============================================================================

describe("calculateTreemapLayout - empty/edge cases", () => {
  it("returns empty cells for empty input", () => {
    const result = calculateTreemapLayout([], { width: 500, height: 400 });
    expect(result.cells.size).toBe(0);
    expect(result.totalWidth).toBe(500);
    expect(result.totalHeight).toBe(400);
  });

  it("filters out zero-value items", () => {
    const items = createItems([0, 0, 0]);
    const result = calculateTreemapLayout(items, { width: 500, height: 400 });
    expect(result.cells.size).toBe(0);
  });

  it("filters out negative-value items", () => {
    const items = createItems([-5, -10]);
    const result = calculateTreemapLayout(items, { width: 500, height: 400 });
    expect(result.cells.size).toBe(0);
  });

  it("handles mix of zero and positive values", () => {
    const items = createItems([0, 10, 0, 5, 0]);
    const result = calculateTreemapLayout(items, { width: 500, height: 400 });
    expect(result.cells.size).toBe(2);
  });
});

// ============================================================================
// Single Item
// ============================================================================

describe("calculateTreemapLayout - single item", () => {
  it("single item fills the entire rectangle (minus gap)", () => {
    const items = createItems([42]);
    const result = calculateTreemapLayout(items, {
      width: 500,
      height: 400,
      gap: 2,
    });

    expect(result.cells.size).toBe(1);
    const cell = result.cells.get("item-1")!;

    // Should fill nearly the entire area (minus gap on each side)
    expect(cell.x).toBeCloseTo(1, 0); // halfGap
    expect(cell.y).toBeCloseTo(1, 0);
    expect(cell.width).toBeCloseTo(498, 0); // 500 - gap
    expect(cell.height).toBeCloseTo(398, 0); // 400 - gap
  });

  it("single item has areaFraction of 1", () => {
    const items = createItems([10]);
    const result = calculateTreemapLayout(items, { width: 200, height: 200 });
    const cell = result.cells.get("item-1")!;
    expect(cell.areaFraction).toBe(1);
  });
});

// ============================================================================
// Two Items
// ============================================================================

describe("calculateTreemapLayout - two items", () => {
  it("two items split the rectangle proportionally", () => {
    const items = createItems([75, 25]);
    const result = calculateTreemapLayout(items, {
      width: 400,
      height: 400,
      gap: 0,
    });

    expect(result.cells.size).toBe(2);
    const cell1 = result.cells.get("item-1")!;
    const cell2 = result.cells.get("item-2")!;

    // Areas should be approximately 3:1
    const area1 = cell1.width * cell1.height;
    const area2 = cell2.width * cell2.height;
    expect(area1 / area2).toBeCloseTo(3, 0);
  });

  it("two equal items have equal areas", () => {
    const items = createItems([50, 50]);
    const result = calculateTreemapLayout(items, {
      width: 400,
      height: 400,
      gap: 0,
    });

    const cell1 = result.cells.get("item-1")!;
    const cell2 = result.cells.get("item-2")!;
    const area1 = cell1.width * cell1.height;
    const area2 = cell2.width * cell2.height;
    expect(area1).toBeCloseTo(area2, 0);
  });

  it("two items do not overlap", () => {
    const items = createItems([60, 40]);
    const result = calculateTreemapLayout(items, { width: 500, height: 300 });
    assertNoOverlaps([...result.cells.values()]);
  });
});

// ============================================================================
// Multiple Items
// ============================================================================

describe("calculateTreemapLayout - multiple items", () => {
  it("all cells are within bounds", () => {
    const items = createItems([100, 80, 60, 40, 20, 10, 5]);
    const result = calculateTreemapLayout(items, {
      width: 600,
      height: 400,
      gap: 2,
    });

    assertWithinBounds([...result.cells.values()], 600, 400);
  });

  it("no cells overlap", () => {
    const items = createItems([100, 80, 60, 40, 20, 10, 5]);
    const result = calculateTreemapLayout(items, {
      width: 600,
      height: 400,
      gap: 2,
    });

    assertNoOverlaps([...result.cells.values()]);
  });

  it("areas are proportional to values", () => {
    const items = createItems([100, 50, 25]);
    const result = calculateTreemapLayout(items, {
      width: 600,
      height: 400,
      gap: 0,
    });

    const cell1 = result.cells.get("item-1")!;
    const cell2 = result.cells.get("item-2")!;
    const cell3 = result.cells.get("item-3")!;

    const area1 = cell1.width * cell1.height;
    const area2 = cell2.width * cell2.height;
    const area3 = cell3.width * cell3.height;

    // 100:50 should give 2:1 ratio
    expect(area1 / area2).toBeCloseTo(2, 0);
    // 100:25 should give 4:1 ratio
    expect(area1 / area3).toBeCloseTo(4, 0);
  });

  it("all items get cells (none lost)", () => {
    const items = createItems([10, 20, 30, 40, 50]);
    const result = calculateTreemapLayout(items, { width: 500, height: 400 });
    expect(result.cells.size).toBe(5);
  });

  it("cell IDs match input IDs", () => {
    const items = createNamedItems([
      { id: "rule-a", value: 30 },
      { id: "rule-b", value: 20 },
      { id: "rule-c", value: 10 },
    ]);
    const result = calculateTreemapLayout(items, { width: 400, height: 300 });

    expect(result.cells.has("rule-a")).toBe(true);
    expect(result.cells.has("rule-b")).toBe(true);
    expect(result.cells.has("rule-c")).toBe(true);
  });
});

// ============================================================================
// Aspect Ratios (Squarified Guarantee)
// ============================================================================

describe("calculateTreemapLayout - squarified aspect ratios", () => {
  it("all cells have aspect ratio < 4:1 for balanced input", () => {
    const items = createItems([100, 80, 60, 40, 20]);
    const result = calculateTreemapLayout(items, {
      width: 600,
      height: 400,
      gap: 0,
    });

    for (const cell of result.cells.values()) {
      expect(aspectRatio(cell)).toBeLessThan(4);
    }
  });

  it("equal values produce reasonably square cells", () => {
    const items = createItems([10, 10, 10, 10]);
    const result = calculateTreemapLayout(items, {
      width: 400,
      height: 400,
      gap: 0,
    });

    for (const cell of result.cells.values()) {
      // Equal values should have reasonable aspect ratios (< 5:1)
      expect(aspectRatio(cell)).toBeLessThan(5);
    }

    // All areas should be equal
    const areas = [...result.cells.values()].map((c) => c.width * c.height);
    for (let i = 1; i < areas.length; i++) {
      expect(areas[i]).toBeCloseTo(areas[0], 0);
    }
  });
});

// ============================================================================
// Determinism
// ============================================================================

describe("calculateTreemapLayout - determinism", () => {
  it("same input produces identical output", () => {
    const items = createItems([50, 30, 20, 10, 5]);
    const config = { width: 500, height: 400, gap: 2 };

    const result1 = calculateTreemapLayout(items, config);
    const result2 = calculateTreemapLayout(items, config);

    expect(result1.cells.size).toBe(result2.cells.size);
    for (const [id, cell1] of result1.cells) {
      const cell2 = result2.cells.get(id)!;
      expect(cell1.x).toBe(cell2.x);
      expect(cell1.y).toBe(cell2.y);
      expect(cell1.width).toBe(cell2.width);
      expect(cell1.height).toBe(cell2.height);
    }
  });

  it("order of input items does not affect layout", () => {
    const items1 = createNamedItems([
      { id: "a", value: 50 },
      { id: "b", value: 30 },
      { id: "c", value: 20 },
    ]);
    const items2 = createNamedItems([
      { id: "c", value: 20 },
      { id: "a", value: 50 },
      { id: "b", value: 30 },
    ]);
    const config = { width: 500, height: 400, gap: 2 };

    const result1 = calculateTreemapLayout(items1, config);
    const result2 = calculateTreemapLayout(items2, config);

    for (const [id, cell1] of result1.cells) {
      const cell2 = result2.cells.get(id)!;
      expect(cell1.x).toBeCloseTo(cell2.x, 5);
      expect(cell1.y).toBeCloseTo(cell2.y, 5);
      expect(cell1.width).toBeCloseTo(cell2.width, 5);
      expect(cell1.height).toBeCloseTo(cell2.height, 5);
    }
  });
});

// ============================================================================
// Gap Handling
// ============================================================================

describe("calculateTreemapLayout - gap handling", () => {
  it("gap=0 produces cells that exactly tile the rectangle", () => {
    const items = createItems([60, 40]);
    const result = calculateTreemapLayout(items, {
      width: 400,
      height: 300,
      gap: 0,
    });

    const totalCellArea = [...result.cells.values()].reduce(
      (sum, c) => sum + c.width * c.height,
      0
    );
    expect(totalCellArea).toBeCloseTo(400 * 300, 0);
  });

  it("gap > 0 reduces total cell area", () => {
    const items = createItems([60, 40]);
    const result = calculateTreemapLayout(items, {
      width: 400,
      height: 300,
      gap: 4,
    });

    const totalCellArea = [...result.cells.values()].reduce(
      (sum, c) => sum + c.width * c.height,
      0
    );
    expect(totalCellArea).toBeLessThan(400 * 300);
  });

  it("cells still do not overlap with gap", () => {
    const items = createItems([50, 30, 20, 10]);
    const result = calculateTreemapLayout(items, {
      width: 500,
      height: 400,
      gap: 4,
    });

    assertNoOverlaps([...result.cells.values()]);
  });
});

// ============================================================================
// Area Fraction
// ============================================================================

describe("calculateTreemapLayout - areaFraction", () => {
  it("largest item has areaFraction of 1", () => {
    const items = createItems([100, 50, 25]);
    const result = calculateTreemapLayout(items, { width: 500, height: 400 });
    const largest = result.cells.get("item-1")!;
    expect(largest.areaFraction).toBe(1);
  });

  it("areaFraction is proportional to value", () => {
    const items = createItems([100, 50, 25]);
    const result = calculateTreemapLayout(items, { width: 500, height: 400 });

    const cell1 = result.cells.get("item-1")!;
    const cell2 = result.cells.get("item-2")!;
    const cell3 = result.cells.get("item-3")!;

    expect(cell1.areaFraction).toBe(1);
    expect(cell2.areaFraction).toBeCloseTo(0.5, 5);
    expect(cell3.areaFraction).toBeCloseTo(0.25, 5);
  });

  it("all areaFractions are between 0 and 1", () => {
    const items = createItems([100, 80, 60, 40, 20, 10]);
    const result = calculateTreemapLayout(items, { width: 500, height: 400 });

    for (const cell of result.cells.values()) {
      expect(cell.areaFraction).toBeGreaterThanOrEqual(0);
      expect(cell.areaFraction).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================================
// Extreme Dimensions
// ============================================================================

describe("calculateTreemapLayout - extreme dimensions", () => {
  it("handles very wide container", () => {
    const items = createItems([50, 30, 20]);
    const result = calculateTreemapLayout(items, {
      width: 1000,
      height: 100,
      gap: 2,
    });

    expect(result.cells.size).toBe(3);
    assertNoOverlaps([...result.cells.values()]);
    assertWithinBounds([...result.cells.values()], 1000, 100);
  });

  it("handles very tall container", () => {
    const items = createItems([50, 30, 20]);
    const result = calculateTreemapLayout(items, {
      width: 100,
      height: 1000,
      gap: 2,
    });

    expect(result.cells.size).toBe(3);
    assertNoOverlaps([...result.cells.values()]);
    assertWithinBounds([...result.cells.values()], 100, 1000);
  });

  it("handles square container", () => {
    const items = createItems([50, 30, 20, 10]);
    const result = calculateTreemapLayout(items, {
      width: 400,
      height: 400,
      gap: 2,
    });

    expect(result.cells.size).toBe(4);
    assertNoOverlaps([...result.cells.values()]);
  });
});

// ============================================================================
// Large Dataset
// ============================================================================

describe("calculateTreemapLayout - large dataset", () => {
  it("handles 50+ items without overlaps", () => {
    const values = Array.from({ length: 50 }, (_, i) => 50 - i);
    const items = createItems(values);
    const result = calculateTreemapLayout(items, {
      width: 800,
      height: 600,
      gap: 1,
    });

    expect(result.cells.size).toBe(50);
    assertNoOverlaps([...result.cells.values()]);
    assertWithinBounds([...result.cells.values()], 800, 600);
  });
});

// ============================================================================
// Default Config
// ============================================================================

describe("calculateTreemapLayout - default config", () => {
  it("uses default dimensions when no config provided", () => {
    const items = createItems([10, 20]);
    const result = calculateTreemapLayout(items);
    expect(result.totalWidth).toBe(500);
    expect(result.totalHeight).toBe(400);
  });

  it("allows partial config override", () => {
    const items = createItems([10, 20]);
    const result = calculateTreemapLayout(items, { width: 300 });
    expect(result.totalWidth).toBe(300);
    expect(result.totalHeight).toBe(400); // default
  });
});

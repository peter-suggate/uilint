/**
 * Tests for Expanded Layout Algorithm
 *
 * These tests verify the calculateExpandedLayout function correctly positions
 * tiles when one tile is expanded to show its children.
 *
 * Key behaviors to test:
 * 1. Tiles above the expanded tile stay in place
 * 2. The expanded tile takes full width at its original Y position
 * 3. Tiles that were beside or below the expanded tile reflow below it
 * 4. Children layout determines the expanded tile's height
 */

import { describe, it, expect } from "vitest";
import { calculateExpandedLayout } from "./expanded-layout";
import type { ExpandedLayoutResult } from "./expanded-layout";
import { calculateMosaicLayout } from "./mosaic-layout";
import type { LayoutItem } from "./types";

// Test constants matching the real layout
const GRID_WIDTH = 532;
const GRID_GAP = 14;
const GRID_PADDING = { top: 20, right: 24, bottom: 20, left: 24 };

// Helper to create test items
function createItems(count: number, countValues?: number[]): LayoutItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    count: countValues?.[i] ?? 10 - i, // Descending counts by default
  }));
}

// Helper to verify no tiles overlap
function verifyNoOverlap(result: ExpandedLayoutResult): void {
  const positions = Array.from(result.positions.values());

  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i];
      const b = positions[j];

      // Check if rectangles overlap
      const horizontalOverlap = a.x < b.x + b.width && a.x + a.width > b.x;
      const verticalOverlap = a.y < b.y + b.height && a.y + a.height > b.y;

      if (horizontalOverlap && verticalOverlap) {
        throw new Error(
          `Tiles overlap: ${a.id} (${a.x},${a.y},${a.width}x${a.height}) and ` +
          `${b.id} (${b.x},${b.y},${b.width}x${b.height})`
        );
      }
    }
  }
}

describe("calculateExpandedLayout", () => {
  describe("Basic scenarios", () => {
    it("should return original layout when no tile is expanded", () => {
      const items = createItems(6);
      const result = calculateExpandedLayout({
        items,
        expandedId: null,
        children: [],
        config: { availableWidth: GRID_WIDTH, gap: GRID_GAP, padding: GRID_PADDING },
      });

      // All tiles should have positions
      expect(result.positions.size).toBe(6);

      // No expanded tile
      expect(result.expandedPosition).toBeNull();

      // Verify no overlaps
      verifyNoOverlap(result);
    });

    it("should expand first tile and move all others below", () => {
      const items = createItems(6);
      const children = createItems(3).map((c) => ({ ...c, id: `child-${c.id}` }));

      const result = calculateExpandedLayout({
        items,
        expandedId: "item-0",
        children,
        config: { availableWidth: GRID_WIDTH, gap: GRID_GAP, padding: GRID_PADDING },
      });

      // Expanded tile should be at top, full width
      const expandedPos = result.expandedPosition!;
      expect(expandedPos.y).toBe(GRID_PADDING.top);
      expect(expandedPos.width).toBe(GRID_WIDTH);

      // All other tiles should be below the expanded tile
      for (const [id, pos] of result.positions) {
        if (id !== "item-0") {
          expect(pos.y).toBeGreaterThanOrEqual(expandedPos.y + expandedPos.height + GRID_GAP);
        }
      }

      verifyNoOverlap(result);
    });

    it("should keep tiles above expanded tile in place", () => {
      const items = createItems(6);
      const children = createItems(2).map((c) => ({ ...c, id: `child-${c.id}` }));

      // Get original layout to find a tile that's NOT in the first row
      const original = calculateMosaicLayout(items, {
        availableWidth: GRID_WIDTH,
        gap: GRID_GAP,
        padding: GRID_PADDING,
      });

      // Find a tile in a lower row (not the first tile)
      let expandedId = "item-3";
      const expandedOriginal = original.tiles.get(expandedId)!;

      const result = calculateExpandedLayout({
        items,
        expandedId,
        children,
        config: { availableWidth: GRID_WIDTH, gap: GRID_GAP, padding: GRID_PADDING },
      });

      // Tiles whose bottom edge was above the expanded tile should keep their Y
      for (const [id, pos] of result.positions) {
        const origPos = original.tiles.get(id);
        if (origPos && origPos.y + origPos.height <= expandedOriginal.y) {
          expect(pos.y).toBe(origPos.y);
        }
      }

      verifyNoOverlap(result);
    });

    it("should expand last tile without moving anything above", () => {
      const items = createItems(6);
      const children = createItems(2).map((c) => ({ ...c, id: `child-${c.id}` }));

      // Get original layout
      const original = calculateMosaicLayout(items, {
        availableWidth: GRID_WIDTH,
        gap: GRID_GAP,
        padding: GRID_PADDING,
      });

      // Find the last tile by Y position
      let lastTileId = "item-0";
      let maxY = 0;
      for (const [id, layout] of original.tiles) {
        if (layout.y > maxY) {
          maxY = layout.y;
          lastTileId = id;
        }
      }

      const result = calculateExpandedLayout({
        items,
        expandedId: lastTileId,
        children,
        config: { availableWidth: GRID_WIDTH, gap: GRID_GAP, padding: GRID_PADDING },
      });

      // All tiles above should keep their original Y positions
      const expandedOriginal = original.tiles.get(lastTileId)!;
      for (const [id, pos] of result.positions) {
        if (id !== lastTileId) {
          const origPos = original.tiles.get(id);
          if (origPos && origPos.y + origPos.height <= expandedOriginal.y) {
            expect(pos.y).toBe(origPos.y);
          }
        }
      }

      verifyNoOverlap(result);
    });
  });

  describe("Complex scenarios", () => {
    it("should handle tiles on same row with different heights", () => {
      // Create items with varying counts to get different bucket sizes
      const items = [
        { id: "tall", count: 100 },   // Will be xl bucket (tallest)
        { id: "medium", count: 50 },  // Will be lg bucket
        { id: "small", count: 10 },   // Will be sm bucket
        { id: "tiny", count: 1 },     // Will be xs bucket
        { id: "expand-me", count: 30 }, // Will be md bucket
        { id: "another", count: 20 }, // Will be sm bucket
      ];

      const children = createItems(3).map((c) => ({ ...c, id: `child-${c.id}` }));

      const result = calculateExpandedLayout({
        items,
        expandedId: "expand-me",
        children,
        config: { availableWidth: GRID_WIDTH, gap: GRID_GAP, padding: GRID_PADDING },
      });

      verifyNoOverlap(result);

      // Expanded tile should be full width
      expect(result.expandedPosition?.width).toBe(GRID_WIDTH);
    });

    it("should handle many children (large expanded height)", () => {
      const items = createItems(6);
      const children = createItems(15).map((c) => ({ ...c, id: `child-${c.id}` }));

      const result = calculateExpandedLayout({
        items,
        expandedId: "item-0",
        children,
        config: { availableWidth: GRID_WIDTH, gap: GRID_GAP, padding: GRID_PADDING },
      });

      // Expanded tile should have significant height
      expect(result.expandedPosition?.height).toBeGreaterThan(200);

      // All other tiles should be well below
      for (const [id, pos] of result.positions) {
        if (id !== "item-0") {
          expect(pos.y).toBeGreaterThan(result.expandedPosition!.y + 200);
        }
      }

      verifyNoOverlap(result);
    });

    it("should handle single child (small expanded height)", () => {
      const items = createItems(6);
      const children = [{ id: "only-child", count: 5 }];

      const result = calculateExpandedLayout({
        items,
        expandedId: "item-0",
        children,
        config: { availableWidth: GRID_WIDTH, gap: GRID_GAP, padding: GRID_PADDING },
      });

      // Expanded tile should have a reasonable height (header + one child + padding)
      // Header is 52, child is ~140 (md bucket), padding is ~24
      expect(result.expandedPosition?.height).toBeLessThan(400);

      verifyNoOverlap(result);
    });

    it("should reflow tiles that were beside expanded tile", () => {
      const items = createItems(3); // 3 tiles likely in same row
      const children = createItems(2).map((c) => ({ ...c, id: `child-${c.id}` }));

      // Get original layout
      const original = calculateMosaicLayout(items, {
        availableWidth: GRID_WIDTH,
        gap: GRID_GAP,
        padding: GRID_PADDING,
      });

      // Expand the first tile
      const result = calculateExpandedLayout({
        items,
        expandedId: "item-0",
        children,
        config: { availableWidth: GRID_WIDTH, gap: GRID_GAP, padding: GRID_PADDING },
      });

      // Tiles that were beside item-0 should now be below
      const expandedY = result.expandedPosition!.y;
      const expandedBottom = expandedY + result.expandedPosition!.height;

      for (const [id, pos] of result.positions) {
        if (id !== "item-0") {
          // These tiles should be below the expanded tile
          expect(pos.y).toBeGreaterThanOrEqual(expandedBottom);
        }
      }

      verifyNoOverlap(result);
    });

    it("should handle expansion when tall tile overlaps vertically", () => {
      // Scenario: A tall tile (xl bucket) that starts above but extends below
      // the row where we expand a tile
      const items = [
        { id: "very-tall", count: 200 },  // xl bucket, spans multiple "rows"
        { id: "normal-1", count: 20 },
        { id: "normal-2", count: 15 },
        { id: "expand-me", count: 10 },
        { id: "normal-3", count: 5 },
      ];

      const children = createItems(4).map((c) => ({ ...c, id: `child-${c.id}` }));

      const result = calculateExpandedLayout({
        items,
        expandedId: "expand-me",
        children,
        config: { availableWidth: GRID_WIDTH, gap: GRID_GAP, padding: GRID_PADDING },
      });

      verifyNoOverlap(result);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty items array", () => {
      const result = calculateExpandedLayout({
        items: [],
        expandedId: null,
        children: [],
        config: { availableWidth: GRID_WIDTH, gap: GRID_GAP, padding: GRID_PADDING },
      });

      expect(result.positions.size).toBe(0);
      expect(result.totalHeight).toBe(GRID_PADDING.top + GRID_PADDING.bottom);
    });

    it("should handle single item expanded", () => {
      const items = [{ id: "only-one", count: 50 }];
      const children = createItems(3).map((c) => ({ ...c, id: `child-${c.id}` }));

      const result = calculateExpandedLayout({
        items,
        expandedId: "only-one",
        children,
        config: { availableWidth: GRID_WIDTH, gap: GRID_GAP, padding: GRID_PADDING },
      });

      expect(result.positions.size).toBe(1);
      expect(result.expandedPosition).not.toBeNull();
      expect(result.expandedPosition?.width).toBe(GRID_WIDTH);

      verifyNoOverlap(result);
    });

    it("should handle expanding non-existent tile", () => {
      const items = createItems(6);

      const result = calculateExpandedLayout({
        items,
        expandedId: "does-not-exist",
        children: [],
        config: { availableWidth: GRID_WIDTH, gap: GRID_GAP, padding: GRID_PADDING },
      });

      // Should fall back to normal layout
      expect(result.positions.size).toBe(6);
      expect(result.expandedPosition).toBeNull();
    });

    it("should handle zero children (collapse immediately?)", () => {
      const items = createItems(6);

      const result = calculateExpandedLayout({
        items,
        expandedId: "item-0",
        children: [], // No children
        config: { availableWidth: GRID_WIDTH, gap: GRID_GAP, padding: GRID_PADDING },
      });

      // With no children, expanded height should be minimal (just header)
      expect(result.expandedPosition?.height).toBeLessThan(100);

      verifyNoOverlap(result);
    });
  });

  describe("Height calculation accuracy", () => {
    it("should calculate expanded height using mosaic layout for children", () => {
      const items = createItems(6);
      const children = [
        { id: "child-big", count: 100 },    // xl bucket
        { id: "child-medium", count: 50 },  // lg bucket
        { id: "child-small", count: 10 },   // sm bucket
      ];

      // First calculate what the children layout would be
      const childLayout = calculateMosaicLayout(children, {
        availableWidth: GRID_WIDTH - 24, // Account for padding
        gap: 10,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      });

      const result = calculateExpandedLayout({
        items,
        expandedId: "item-0",
        children,
        config: { availableWidth: GRID_WIDTH, gap: GRID_GAP, padding: GRID_PADDING },
      });

      // The expanded height should include header + children layout + padding
      const expectedMinHeight = 52 + childLayout.totalHeight + 24; // header + children + padding
      expect(result.expandedPosition?.height).toBeGreaterThanOrEqual(expectedMinHeight - 10); // Small tolerance
    });
  });
});

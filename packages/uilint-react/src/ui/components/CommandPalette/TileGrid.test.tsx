/**
 * Tests for TileGrid component
 *
 * The TileGrid component renders a masonry grid of Tile components with
 * normalized percentile-based bucket sizing based on item counts.
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { TileGrid } from "./TileGrid";
import type { TileItem } from "../../../core/plugin-system/types";

// Mock motion/react to avoid animation issues in tests
vi.mock("motion/react", () => {
  const React = require("react");
  const motion = new Proxy(
    {},
    {
      get(_target: unknown, prop: string) {
        return React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
          const filtered: Record<string, unknown> = {};
          for (const [key, val] of Object.entries(props)) {
            if (!["initial", "animate", "exit", "transition", "whileHover", "whileTap", "layout"].includes(key)) {
              filtered[key] = val;
            }
          }
          return React.createElement(prop, { ...filtered, ref });
        });
      },
    }
  );
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion,
  };
});

const createTestItem = (id: string, count: number, label?: string): TileItem => ({
  id,
  label: label || `Item ${id}`,
  count,
});

describe("TileGrid - rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders correct number of tiles", () => {
    const items: TileItem[] = [
      createTestItem("1", 10),
      createTestItem("2", 20),
      createTestItem("3", 30),
    ];

    const { container } = render(
      <TileGrid
        items={items}
        onTileClick={vi.fn()}
        selectedIndex={-1}
      />
    );

    // Each tile has a specific structure - look for elements with cursor: pointer
    // which are the tile root elements
    const allElements = container.querySelectorAll("*");
    let tileCount = 0;

    allElements.forEach((el) => {
      const style = el.getAttribute("style");
      // Tiles have cursor: pointer and specific height values
      if (style && style.includes("cursor: pointer") && style.includes("height:")) {
        tileCount++;
      }
    });

    expect(tileCount).toBe(3);
  });

  it("renders all item labels", () => {
    const items: TileItem[] = [
      createTestItem("1", 10, "First Rule"),
      createTestItem("2", 20, "Second Rule"),
      createTestItem("3", 30, "Third Rule"),
    ];

    const { container } = render(
      <TileGrid
        items={items}
        onTileClick={vi.fn()}
        selectedIndex={-1}
      />
    );

    expect(container.textContent).toContain("First Rule");
    expect(container.textContent).toContain("Second Rule");
    expect(container.textContent).toContain("Third Rule");
  });
});

describe("TileGrid - bucket sizing", () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * Bucket distribution based on percentiles:
   * - Top 10% by count = xl (200px)
   * - Next 20% (10-30%) = lg (150px)
   * - Next 30% (30-60%) = md (110px)
   * - Next 25% (60-85%) = sm (80px)
   * - Bottom 15% (85-100%) = xs (60px)
   */
  it("calculates bucket sizes correctly based on count percentiles", () => {
    // Create 10 items with varying counts to test percentile distribution
    const items: TileItem[] = [
      createTestItem("1", 100),   // Top 10% -> xl (200px)
      createTestItem("2", 90),    // 10-20% -> lg (150px)
      createTestItem("3", 80),    // 20-30% -> lg (150px)
      createTestItem("4", 70),    // 30-40% -> md (110px)
      createTestItem("5", 60),    // 40-50% -> md (110px)
      createTestItem("6", 50),    // 50-60% -> md (110px)
      createTestItem("7", 40),    // 60-70% -> sm (80px)
      createTestItem("8", 30),    // 70-80% -> sm (80px)
      createTestItem("9", 20),    // 80-85% -> sm (80px)
      createTestItem("10", 10),   // 85-100% -> xs (60px)
    ];

    const { container } = render(
      <TileGrid
        items={items}
        onTileClick={vi.fn()}
        selectedIndex={-1}
      />
    );

    // Find all tile elements by looking for elements with height styles
    const allElements = container.querySelectorAll("*");
    const tileHeights: number[] = [];

    allElements.forEach((el) => {
      const style = el.getAttribute("style");
      if (style && style.includes("cursor: pointer")) {
        const heightMatch = style.match(/height:\s*(\d+)px/);
        if (heightMatch) {
          tileHeights.push(parseInt(heightMatch[1], 10));
        }
      }
    });

    // With 10 items:
    // - 1 item (10%) should be xl = 200px
    // - 2 items (20%) should be lg = 150px
    // - 3 items (30%) should be md = 110px
    // - 2-3 items (25%) should be sm = 80px
    // - 1-2 items (15%) should be xs = 60px

    expect(tileHeights).toContain(200); // xl bucket
    expect(tileHeights).toContain(150); // lg bucket
    expect(tileHeights).toContain(110); // md bucket
    expect(tileHeights).toContain(80);  // sm bucket
    expect(tileHeights).toContain(60);  // xs bucket
  });

  it("handles single item gracefully (assigns xl bucket)", () => {
    const items: TileItem[] = [createTestItem("1", 50)];

    const { container } = render(
      <TileGrid
        items={items}
        onTileClick={vi.fn()}
        selectedIndex={-1}
      />
    );

    const allElements = container.querySelectorAll("*");
    let foundHeight: number | null = null;

    allElements.forEach((el) => {
      const style = el.getAttribute("style");
      if (style && style.includes("cursor: pointer")) {
        const heightMatch = style.match(/height:\s*(\d+)px/);
        if (heightMatch) {
          foundHeight = parseInt(heightMatch[1], 10);
        }
      }
    });

    // Single item is at 0% percentile (top) -> xl = 200px
    expect(foundHeight).toBe(200);
  });
});

describe("TileGrid - selection", () => {
  afterEach(() => {
    cleanup();
  });

  it("passes correct selectedIndex to tiles (selected tile shows accent styling)", () => {
    const items: TileItem[] = [
      createTestItem("1", 10),
      createTestItem("2", 20),
      createTestItem("3", 30),
    ];

    const { container } = render(
      <TileGrid
        items={items}
        onTileClick={vi.fn()}
        selectedIndex={1}  // Second item should be selected
      />
    );

    // Find all tile elements
    const allElements = container.querySelectorAll("*");
    let selectedTileFound = false;

    allElements.forEach((el) => {
      const style = el.getAttribute("style");
      // Selected tile should have accent border styling
      if (style && style.includes("var(--uilint-accent)") && style.includes("cursor: pointer")) {
        selectedTileFound = true;
        // Also verify it has the info-bg background
        expect(style).toContain("var(--uilint-info-bg)");
      }
    });

    expect(selectedTileFound).toBe(true);
  });

  it("shows no selected tile when selectedIndex is -1", () => {
    const items: TileItem[] = [
      createTestItem("1", 10),
      createTestItem("2", 20),
    ];

    const { container } = render(
      <TileGrid
        items={items}
        onTileClick={vi.fn()}
        selectedIndex={-1}
      />
    );

    // No tile should have selected styling (accent border)
    const allElements = container.querySelectorAll("*");
    let selectedTileFound = false;

    allElements.forEach((el) => {
      const style = el.getAttribute("style");
      if (style && style.includes("var(--uilint-accent)") && style.includes("cursor: pointer")) {
        selectedTileFound = true;
      }
    });

    expect(selectedTileFound).toBe(false);
  });
});

describe("TileGrid - interactions", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onTileClick when a tile is clicked", () => {
    const onTileClick = vi.fn();
    const items: TileItem[] = [
      createTestItem("1", 10, "First Item"),
      createTestItem("2", 20, "Second Item"),
    ];

    const { container } = render(
      <TileGrid
        items={items}
        onTileClick={onTileClick}
        selectedIndex={-1}
      />
    );

    // Find tile elements and click the first one
    const allElements = container.querySelectorAll("*");
    const tiles: HTMLElement[] = [];

    allElements.forEach((el) => {
      const style = el.getAttribute("style");
      if (style && style.includes("cursor: pointer") && style.includes("height:")) {
        tiles.push(el as HTMLElement);
      }
    });

    expect(tiles.length).toBe(2);

    // Click the first tile - tiles are sorted by count (descending),
    // so tiles[0] is "Second Item" (count: 20)
    fireEvent.click(tiles[0]);
    expect(onTileClick).toHaveBeenCalledTimes(1);
    expect(onTileClick).toHaveBeenCalledWith(items[1]); // Second Item has highest count
  });

  it("calls onTileClick with correct item when different tiles are clicked", () => {
    const onTileClick = vi.fn();
    // Items sorted by count descending: Third (30), Second (20), First (10)
    const items: TileItem[] = [
      createTestItem("1", 10, "First"),
      createTestItem("2", 20, "Second"),
      createTestItem("3", 30, "Third"),
    ];

    const { container } = render(
      <TileGrid
        items={items}
        onTileClick={onTileClick}
        selectedIndex={-1}
      />
    );

    const allElements = container.querySelectorAll("*");
    const tiles: HTMLElement[] = [];

    allElements.forEach((el) => {
      const style = el.getAttribute("style");
      if (style && style.includes("cursor: pointer") && style.includes("height:")) {
        tiles.push(el as HTMLElement);
      }
    });

    // Click each tile - tiles are sorted by count (descending)
    // tiles[0] = Third (count 30), tiles[1] = Second (count 20), tiles[2] = First (count 10)
    fireEvent.click(tiles[0]);
    expect(onTileClick).toHaveBeenLastCalledWith(items[2]); // Third

    fireEvent.click(tiles[1]);
    expect(onTileClick).toHaveBeenLastCalledWith(items[1]); // Second

    fireEvent.click(tiles[2]);
    expect(onTileClick).toHaveBeenLastCalledWith(items[0]); // First

    expect(onTileClick).toHaveBeenCalledTimes(3);
  });
});

describe("TileGrid - empty state", () => {
  afterEach(() => {
    cleanup();
  });

  it("handles empty items array gracefully", () => {
    const { container } = render(
      <TileGrid
        items={[]}
        onTileClick={vi.fn()}
        selectedIndex={-1}
      />
    );

    // Should render empty state message
    expect(container.textContent).toContain("No items to display");
  });

  it("renders empty state with helpful message", () => {
    const { container } = render(
      <TileGrid
        items={[]}
        onTileClick={vi.fn()}
        selectedIndex={-1}
      />
    );

    expect(container.textContent).toContain("No items to display");
    expect(container.textContent).toContain("Try adjusting your filters");
  });

  it("does not call onTileClick when empty", () => {
    const onTileClick = vi.fn();

    render(
      <TileGrid
        items={[]}
        onTileClick={onTileClick}
        selectedIndex={-1}
      />
    );

    // Nothing to click, so onTileClick should never be called
    expect(onTileClick).not.toHaveBeenCalled();
  });
});

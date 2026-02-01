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

    // Each tile wrapper has absolute positioning with height style
    // Tiles themselves have cursor-pointer class
    const allElements = container.querySelectorAll("*");
    let tileCount = 0;

    allElements.forEach((el) => {
      const classAttr = el.getAttribute("class") || "";
      // Tiles have cursor-pointer and rounded-2xl classes
      if (classAttr.includes("cursor-pointer") && classAttr.includes("rounded-2xl")) {
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
   * - Top 10% by count = xl (220px)
   * - Next 20% (10-30%) = lg (168px)
   * - Next 30% (30-60%) = md (128px)
   * - Next 25% (60-85%) = sm (96px)
   * - Bottom 15% (85-100%) = xs (72px)
   */
  it("calculates bucket sizes correctly based on count percentiles", () => {
    // Create 10 items with varying counts to test percentile distribution
    const items: TileItem[] = [
      createTestItem("1", 100),   // Top 10% -> xl (220px)
      createTestItem("2", 90),    // 10-20% -> lg (168px)
      createTestItem("3", 80),    // 20-30% -> lg (168px)
      createTestItem("4", 70),    // 30-40% -> md (128px)
      createTestItem("5", 60),    // 40-50% -> md (128px)
      createTestItem("6", 50),    // 50-60% -> md (128px)
      createTestItem("7", 40),    // 60-70% -> sm (96px)
      createTestItem("8", 30),    // 70-80% -> sm (96px)
      createTestItem("9", 20),    // 80-85% -> sm (96px)
      createTestItem("10", 10),   // 85-100% -> xs (72px)
    ];

    const { container } = render(
      <TileGrid
        items={items}
        onTileClick={vi.fn()}
        selectedIndex={-1}
      />
    );

    // Find all tile wrapper elements by looking for elements with height styles
    // (wrapper divs have absolute positioning with height)
    const allElements = container.querySelectorAll("*");
    const tileHeights: number[] = [];

    allElements.forEach((el) => {
      const style = el.getAttribute("style");
      if (style && style.includes("height:")) {
        const heightMatch = style.match(/height:\s*(\d+)px/);
        if (heightMatch) {
          tileHeights.push(parseInt(heightMatch[1], 10));
        }
      }
    });

    // With 10 items, verify we have tiles at various sizes
    expect(tileHeights).toContain(220); // xl bucket
    expect(tileHeights).toContain(168); // lg bucket
    expect(tileHeights).toContain(128); // md bucket
    expect(tileHeights).toContain(96);  // sm bucket
    expect(tileHeights).toContain(72);  // xs bucket
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
      if (style && style.includes("height:")) {
        const heightMatch = style.match(/height:\s*(\d+)px/);
        if (heightMatch) {
          foundHeight = parseInt(heightMatch[1], 10);
        }
      }
    });

    // Single item is at 0% percentile (top) -> xl = 220px
    expect(foundHeight).toBe(220);
  });
});

describe("TileGrid - selection", () => {
  afterEach(() => {
    cleanup();
  });

  it("passes correct selectedIndex to tiles (selected tile shows distinct styling)", () => {
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

    // Find tiles with selected glassmorphic styling (bg-glass-medium class)
    const allElements = container.querySelectorAll("*");
    let selectedTileFound = false;

    allElements.forEach((el) => {
      const classAttr = el.getAttribute("class") || "";
      // Selected tile has bg-glass-medium class without the /50 border opacity
      if (classAttr.includes("bg-glass-medium") && classAttr.includes("cursor-pointer")) {
        selectedTileFound = true;
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

    // No tile should have selected styling (bg-glass-medium without hover)
    // All tiles should have bg-glass-light
    const allElements = container.querySelectorAll("*");
    let allHaveLightBackground = true;

    allElements.forEach((el) => {
      const classAttr = el.getAttribute("class") || "";
      if (classAttr.includes("cursor-pointer") && classAttr.includes("rounded-2xl")) {
        // This is a tile - it should have glass-light, not glass-medium
        if (classAttr.includes("bg-glass-medium") && !classAttr.includes("hover:bg-glass-medium")) {
          allHaveLightBackground = false;
        }
      }
    });

    expect(allHaveLightBackground).toBe(true);
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

    // Find tile elements by their class
    const allElements = container.querySelectorAll("*");
    const tiles: HTMLElement[] = [];

    allElements.forEach((el) => {
      const classAttr = el.getAttribute("class") || "";
      if (classAttr.includes("cursor-pointer") && classAttr.includes("rounded-2xl")) {
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
      const classAttr = el.getAttribute("class") || "";
      if (classAttr.includes("cursor-pointer") && classAttr.includes("rounded-2xl")) {
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

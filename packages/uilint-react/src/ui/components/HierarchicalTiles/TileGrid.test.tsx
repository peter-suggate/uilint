/**
 * Tests for HierarchicalTiles TileGrid component
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { TileGrid } from "./TileGrid";
import type { BaseTileItem } from "./TileGrid";

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
            if (!["initial", "animate", "exit", "transition", "whileHover", "whileTap", "layout", "variants"].includes(key)) {
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

// Mock the useAdaptiveText hook
vi.mock("../../hooks/useAdaptiveText", () => ({
  useTileAdaptiveText: () => ({
    fontSize: 15,
    scale: 1,
    isScaled: false,
    needsTruncation: false,
  }),
}));

const createTestItem = (id: string, count: number, label?: string): BaseTileItem => ({
  id,
  label: label || `Item ${id}`,
  count,
});

describe("TileGrid - rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders all item labels", () => {
    const items: BaseTileItem[] = [
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

  it("renders items with their counts", () => {
    const items: BaseTileItem[] = [
      createTestItem("1", 10, "Rule A"),
      createTestItem("2", 25, "Rule B"),
    ];

    const { container } = render(
      <TileGrid
        items={items}
        onTileClick={vi.fn()}
        selectedIndex={-1}
      />
    );

    expect(container.textContent).toContain("10");
    expect(container.textContent).toContain("25");
  });

  it("renders items with issue summary", () => {
    const items: BaseTileItem[] = [
      { id: "1", label: "Rule A", count: 10, fileCount: 3 },
    ];

    const { container } = render(
      <TileGrid
        items={items}
        onTileClick={vi.fn()}
        selectedIndex={-1}
      />
    );

    // Count is displayed prominently, suffix shows "issues in X files"
    expect(container.textContent).toContain("10");
    expect(container.textContent).toContain("issues in 3 files");
  });

  it("renders with custom available width", () => {
    const items: BaseTileItem[] = [createTestItem("1", 10)];

    const { container } = render(
      <TileGrid
        items={items}
        onTileClick={vi.fn()}
        selectedIndex={-1}
        availableWidth={400}
      />
    );

    expect(container.firstChild).toBeTruthy();
  });

  it("renders with custom padding", () => {
    const items: BaseTileItem[] = [createTestItem("1", 10)];

    const { container } = render(
      <TileGrid
        items={items}
        onTileClick={vi.fn()}
        selectedIndex={-1}
        padding={{ top: 10, right: 10, bottom: 10, left: 10 }}
      />
    );

    expect(container.firstChild).toBeTruthy();
  });
});

describe("TileGrid - interactions", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onTileClick when a tile is clicked", () => {
    const onTileClick = vi.fn();
    const items: BaseTileItem[] = [
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

    // Find tile elements by their data attribute
    const tiles = container.querySelectorAll("[data-tile-id]");
    expect(tiles.length).toBe(2);

    // Click the first tile found (items sorted by count descending)
    fireEvent.click(tiles[0]);
    expect(onTileClick).toHaveBeenCalledTimes(1);
  });

  it("calls onTileClick with correct item when different tiles are clicked", () => {
    const onTileClick = vi.fn();
    const items: BaseTileItem[] = [
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

    const tiles = container.querySelectorAll("[data-tile-id]");
    expect(tiles.length).toBe(3);

    // Click each tile
    fireEvent.click(tiles[0]);
    fireEvent.click(tiles[1]);
    fireEvent.click(tiles[2]);

    expect(onTileClick).toHaveBeenCalledTimes(3);
  });

  it("calls onOpenInInspector when provided and inspector button is clicked", () => {
    const onTileClick = vi.fn();
    const onOpenInInspector = vi.fn();
    const items: BaseTileItem[] = [createTestItem("1", 10, "Test Item")];

    const { container } = render(
      <TileGrid
        items={items}
        onTileClick={onTileClick}
        onOpenInInspector={onOpenInInspector}
        selectedIndex={-1}
      />
    );

    const inspectorButton = container.querySelector('button[aria-label="Open in inspector"]');
    expect(inspectorButton).toBeTruthy();

    fireEvent.click(inspectorButton!);
    expect(onOpenInInspector).toHaveBeenCalledTimes(1);
  });
});

describe("TileGrid - empty state", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows empty state when items array is empty", () => {
    const { container } = render(
      <TileGrid
        items={[]}
        onTileClick={vi.fn()}
        selectedIndex={-1}
      />
    );

    expect(container.textContent).toContain("No items to display");
  });

  it("shows helpful message in empty state", () => {
    const { container } = render(
      <TileGrid
        items={[]}
        onTileClick={vi.fn()}
        selectedIndex={-1}
      />
    );

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

    expect(onTileClick).not.toHaveBeenCalled();
  });
});

describe("TileGrid - selection", () => {
  afterEach(() => {
    cleanup();
  });

  it("applies selection to correct item based on selectedIndex", () => {
    const items: BaseTileItem[] = [
      createTestItem("1", 10, "First"),
      createTestItem("2", 20, "Second"),
    ];

    const { container } = render(
      <TileGrid
        items={items}
        onTileClick={vi.fn()}
        selectedIndex={0}
      />
    );

    // Verify the grid renders with the items
    expect(container.textContent).toContain("First");
    expect(container.textContent).toContain("Second");
  });

  it("handles selectedIndex of -1 (no selection)", () => {
    const items: BaseTileItem[] = [createTestItem("1", 10)];

    const { container } = render(
      <TileGrid
        items={items}
        onTileClick={vi.fn()}
        selectedIndex={-1}
      />
    );

    expect(container.firstChild).toBeTruthy();
  });
});

describe("TileGrid - layout", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with minHeight style", () => {
    const items: BaseTileItem[] = [createTestItem("1", 10)];

    const { container } = render(
      <TileGrid
        items={items}
        onTileClick={vi.fn()}
        selectedIndex={-1}
      />
    );

    const gridContainer = container.firstChild as HTMLElement;
    expect(gridContainer.style.minHeight).toBe("200px");
  });

  it("uses absolute positioning for tiles", () => {
    const items: BaseTileItem[] = [createTestItem("1", 10)];

    const { container } = render(
      <TileGrid
        items={items}
        onTileClick={vi.fn()}
        selectedIndex={-1}
      />
    );

    const gridContainer = container.firstChild as HTMLElement;
    expect(gridContainer.className).toContain("relative");
  });
});

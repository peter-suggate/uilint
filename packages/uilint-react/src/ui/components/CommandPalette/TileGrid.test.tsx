/**
 * Tests for TileGrid component behavior
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

    const { getByText } = render(
      <TileGrid
        items={items}
        onTileClick={onTileClick}
        selectedIndex={-1}
      />
    );

    // Find and click a specific tile by its label
    const firstItemTile = getByText("First Item").closest("[class*='cursor-pointer']");
    expect(firstItemTile).toBeTruthy();

    fireEvent.click(firstItemTile!);
    expect(onTileClick).toHaveBeenCalledTimes(1);
    expect(onTileClick).toHaveBeenCalledWith(items[0]); // First Item
  });

  it("calls onTileClick with correct item when different tiles are clicked", () => {
    const onTileClick = vi.fn();
    const items: TileItem[] = [
      createTestItem("1", 10, "First"),
      createTestItem("2", 20, "Second"),
      createTestItem("3", 30, "Third"),
    ];

    const { getByText } = render(
      <TileGrid
        items={items}
        onTileClick={onTileClick}
        selectedIndex={-1}
      />
    );

    // Click each tile by finding it via its label
    const thirdTile = getByText("Third").closest("[class*='cursor-pointer']");
    const secondTile = getByText("Second").closest("[class*='cursor-pointer']");
    const firstTile = getByText("First").closest("[class*='cursor-pointer']");

    fireEvent.click(thirdTile!);
    expect(onTileClick).toHaveBeenLastCalledWith(items[2]); // Third

    fireEvent.click(secondTile!);
    expect(onTileClick).toHaveBeenLastCalledWith(items[1]); // Second

    fireEvent.click(firstTile!);
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

    expect(container.textContent).toContain("No items to display");
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

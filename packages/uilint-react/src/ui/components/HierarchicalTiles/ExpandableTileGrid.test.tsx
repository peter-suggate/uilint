/**
 * Tests for ExpandableTileGrid component
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { ExpandableTileGrid } from "./ExpandableTileGrid";
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
            if (!["initial", "animate", "exit", "transition", "whileHover", "whileTap", "layout", "variants", "layoutId"].includes(key)) {
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

describe("ExpandableTileGrid - rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders all items when not expanded", () => {
    const items: BaseTileItem[] = [
      createTestItem("1", 10, "First Rule"),
      createTestItem("2", 20, "Second Rule"),
      createTestItem("3", 30, "Third Rule"),
    ];

    const { container } = render(
      <ExpandableTileGrid
        items={items}
        expandedId={null}
        expandedChildren={[]}
        onTileClick={vi.fn()}
        onExpandedChildClick={vi.fn()}
        onBack={vi.fn()}
        availableWidth={500}
      />
    );

    expect(container.textContent).toContain("First Rule");
    expect(container.textContent).toContain("Second Rule");
    expect(container.textContent).toContain("Third Rule");
  });

  it("renders items with counts", () => {
    const items: BaseTileItem[] = [
      createTestItem("1", 10, "Rule A"),
      createTestItem("2", 25, "Rule B"),
    ];

    const { container } = render(
      <ExpandableTileGrid
        items={items}
        expandedId={null}
        expandedChildren={[]}
        onTileClick={vi.fn()}
        onExpandedChildClick={vi.fn()}
        onBack={vi.fn()}
        availableWidth={500}
      />
    );

    expect(container.textContent).toContain("10");
    expect(container.textContent).toContain("25");
  });

  it("renders with custom gap", () => {
    const items: BaseTileItem[] = [createTestItem("1", 10)];

    const { container } = render(
      <ExpandableTileGrid
        items={items}
        expandedId={null}
        expandedChildren={[]}
        onTileClick={vi.fn()}
        onExpandedChildClick={vi.fn()}
        onBack={vi.fn()}
        availableWidth={500}
        gap={20}
      />
    );

    expect(container.firstChild).toBeTruthy();
  });

  it("renders with custom padding", () => {
    const items: BaseTileItem[] = [createTestItem("1", 10)];

    const { container } = render(
      <ExpandableTileGrid
        items={items}
        expandedId={null}
        expandedChildren={[]}
        onTileClick={vi.fn()}
        onExpandedChildClick={vi.fn()}
        onBack={vi.fn()}
        availableWidth={500}
        padding={{ top: 10, right: 10, bottom: 10, left: 10 }}
      />
    );

    expect(container.firstChild).toBeTruthy();
  });
});

describe("ExpandableTileGrid - expansion", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows expanded content when expandedId matches an item", () => {
    const items: BaseTileItem[] = [
      createTestItem("1", 10, "First Rule"),
      createTestItem("2", 20, "Second Rule"),
    ];
    const children: BaseTileItem[] = [
      createTestItem("child-1", 5, "Child Issue 1"),
      createTestItem("child-2", 3, "Child Issue 2"),
    ];

    const { container } = render(
      <ExpandableTileGrid
        items={items}
        expandedId="1"
        expandedChildren={children}
        onTileClick={vi.fn()}
        onExpandedChildClick={vi.fn()}
        onBack={vi.fn()}
        availableWidth={500}
      />
    );

    // The expanded tile should show children
    expect(container.textContent).toContain("Child Issue 1");
    expect(container.textContent).toContain("Child Issue 2");
  });

  it("shows expanded tile header with label", () => {
    const items: BaseTileItem[] = [
      createTestItem("1", 10, "First Rule"),
    ];

    const { container } = render(
      <ExpandableTileGrid
        items={items}
        expandedId="1"
        expandedChildren={[]}
        onTileClick={vi.fn()}
        onExpandedChildClick={vi.fn()}
        onBack={vi.fn()}
        availableWidth={500}
      />
    );

    expect(container.textContent).toContain("First Rule");
  });

  it("renders both expanded and non-expanded tiles", () => {
    const items: BaseTileItem[] = [
      createTestItem("1", 10, "First Rule"),
      createTestItem("2", 20, "Second Rule"),
      createTestItem("3", 30, "Third Rule"),
    ];

    const { container } = render(
      <ExpandableTileGrid
        items={items}
        expandedId="1"
        expandedChildren={[]}
        onTileClick={vi.fn()}
        onExpandedChildClick={vi.fn()}
        onBack={vi.fn()}
        availableWidth={500}
      />
    );

    // All items should still be present (expanded or collapsed)
    expect(container.textContent).toContain("First Rule");
    expect(container.textContent).toContain("Second Rule");
    expect(container.textContent).toContain("Third Rule");
  });
});

describe("ExpandableTileGrid - interactions", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onTileClick when a non-expanded tile is clicked", () => {
    const onTileClick = vi.fn();
    const items: BaseTileItem[] = [
      createTestItem("1", 10, "First Rule"),
      createTestItem("2", 20, "Second Rule"),
    ];

    const { container } = render(
      <ExpandableTileGrid
        items={items}
        expandedId={null}
        expandedChildren={[]}
        onTileClick={onTileClick}
        onExpandedChildClick={vi.fn()}
        onBack={vi.fn()}
        availableWidth={500}
      />
    );

    const tiles = container.querySelectorAll("[data-tile-id]");
    expect(tiles.length).toBe(2);

    fireEvent.click(tiles[0]);
    expect(onTileClick).toHaveBeenCalledTimes(1);
  });

  it("calls onBack when back button is clicked on expanded tile", () => {
    const onBack = vi.fn();
    const items: BaseTileItem[] = [createTestItem("1", 10, "First Rule")];

    const { container } = render(
      <ExpandableTileGrid
        items={items}
        expandedId="1"
        expandedChildren={[]}
        onTileClick={vi.fn()}
        onExpandedChildClick={vi.fn()}
        onBack={onBack}
        availableWidth={500}
      />
    );

    // Find the back button by aria-label
    const backButton = container.querySelector('button[aria-label="Go back"]');
    expect(backButton).toBeTruthy();

    fireEvent.click(backButton!);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("calls onExpandedChildClick when a child tile is clicked", () => {
    const onExpandedChildClick = vi.fn();
    const items: BaseTileItem[] = [createTestItem("1", 10, "First Rule")];
    const children: BaseTileItem[] = [
      createTestItem("child-1", 5, "Child Issue"),
    ];

    const { container } = render(
      <ExpandableTileGrid
        items={items}
        expandedId="1"
        expandedChildren={children}
        onTileClick={vi.fn()}
        onExpandedChildClick={onExpandedChildClick}
        onBack={vi.fn()}
        availableWidth={500}
      />
    );

    // Find child tiles
    const childTiles = container.querySelectorAll('[data-tile-id="child-1"]');
    expect(childTiles.length).toBeGreaterThan(0);

    fireEvent.click(childTiles[0]);
    expect(onExpandedChildClick).toHaveBeenCalledTimes(1);
  });
});

describe("ExpandableTileGrid - selection", () => {
  afterEach(() => {
    cleanup();
  });

  it("applies selection based on selectedIndex", () => {
    const items: BaseTileItem[] = [
      createTestItem("1", 10, "First"),
      createTestItem("2", 20, "Second"),
    ];

    const { container } = render(
      <ExpandableTileGrid
        items={items}
        expandedId={null}
        expandedChildren={[]}
        onTileClick={vi.fn()}
        onExpandedChildClick={vi.fn()}
        onBack={vi.fn()}
        availableWidth={500}
        selectedIndex={0}
      />
    );

    expect(container.textContent).toContain("First");
    expect(container.textContent).toContain("Second");
  });

  it("handles selectedIndex of -1", () => {
    const items: BaseTileItem[] = [createTestItem("1", 10)];

    const { container } = render(
      <ExpandableTileGrid
        items={items}
        expandedId={null}
        expandedChildren={[]}
        onTileClick={vi.fn()}
        onExpandedChildClick={vi.fn()}
        onBack={vi.fn()}
        availableWidth={500}
        selectedIndex={-1}
      />
    );

    expect(container.firstChild).toBeTruthy();
  });
});

describe("ExpandableTileGrid - custom rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses renderExpandedContent when provided", () => {
    const items: BaseTileItem[] = [createTestItem("1", 10, "First Rule")];
    const children: BaseTileItem[] = [createTestItem("child-1", 5, "Child")];

    const renderExpandedContent = vi.fn().mockReturnValue(
      <div data-testid="custom-content">Custom Expanded Content</div>
    );

    const { getByTestId } = render(
      <ExpandableTileGrid
        items={items}
        expandedId="1"
        expandedChildren={children}
        onTileClick={vi.fn()}
        onExpandedChildClick={vi.fn()}
        onBack={vi.fn()}
        availableWidth={500}
        renderExpandedContent={renderExpandedContent}
      />
    );

    expect(getByTestId("custom-content")).toBeTruthy();
    expect(renderExpandedContent).toHaveBeenCalled();
  });

  it("passes correct arguments to renderExpandedContent", () => {
    const items: BaseTileItem[] = [createTestItem("1", 10, "First Rule")];
    const children: BaseTileItem[] = [createTestItem("child-1", 5, "Child")];

    const renderExpandedContent = vi.fn().mockReturnValue(<div>Custom</div>);

    render(
      <ExpandableTileGrid
        items={items}
        expandedId="1"
        expandedChildren={children}
        onTileClick={vi.fn()}
        onExpandedChildClick={vi.fn()}
        onBack={vi.fn()}
        availableWidth={500}
        renderExpandedContent={renderExpandedContent}
      />
    );

    // Should be called with (item, children, childrenHeight, availableWidth)
    expect(renderExpandedContent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "1", label: "First Rule" }),
      expect.arrayContaining([expect.objectContaining({ id: "child-1" })]),
      expect.any(Number),
      500
    );
  });
});

describe("ExpandableTileGrid - layout", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with minHeight style", () => {
    const items: BaseTileItem[] = [createTestItem("1", 10)];

    const { container } = render(
      <ExpandableTileGrid
        items={items}
        expandedId={null}
        expandedChildren={[]}
        onTileClick={vi.fn()}
        onExpandedChildClick={vi.fn()}
        onBack={vi.fn()}
        availableWidth={500}
      />
    );

    const gridContainer = container.firstChild as HTMLElement;
    expect(gridContainer.style.minHeight).toBe("200px");
  });

  it("uses relative positioning for container", () => {
    const items: BaseTileItem[] = [createTestItem("1", 10)];

    const { container } = render(
      <ExpandableTileGrid
        items={items}
        expandedId={null}
        expandedChildren={[]}
        onTileClick={vi.fn()}
        onExpandedChildClick={vi.fn()}
        onBack={vi.fn()}
        availableWidth={500}
      />
    );

    const gridContainer = container.firstChild as HTMLElement;
    expect(gridContainer.className).toContain("relative");
  });

  it("applies extraExpandedHeight when expanded", () => {
    const items: BaseTileItem[] = [createTestItem("1", 10, "First Rule")];

    const { container } = render(
      <ExpandableTileGrid
        items={items}
        expandedId="1"
        expandedChildren={[]}
        onTileClick={vi.fn()}
        onExpandedChildClick={vi.fn()}
        onBack={vi.fn()}
        availableWidth={500}
        extraExpandedHeight={100}
      />
    );

    expect(container.firstChild).toBeTruthy();
  });
});

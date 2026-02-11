/**
 * Tests for TreemapGrid component
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { TreemapGrid } from "./TreemapGrid";
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
            if (
              ![
                "initial",
                "animate",
                "exit",
                "transition",
                "whileHover",
                "whileTap",
                "layout",
                "variants",
              ].includes(key)
            ) {
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

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Sparkles: () => React.createElement("span", null, "✨"),
}));

// ============================================================================
// Test Data
// ============================================================================

const createTestItem = (
  id: string,
  count: number,
  label?: string
): BaseTileItem => ({
  id,
  label: label ?? `Rule ${id}`,
  count,
  severityCounts: { error: count > 20 ? count : 0, warning: count <= 20 ? count : 0, info: 0 },
});

const testItems: BaseTileItem[] = [
  createTestItem("rule-1", 42, "no-unused-vars"),
  createTestItem("rule-2", 15, "no-console"),
  createTestItem("rule-3", 8, "prefer-const"),
];

const testChildren: BaseTileItem[] = [
  createTestItem("file-1", 20, "App.tsx"),
  createTestItem("file-2", 12, "utils.ts"),
  createTestItem("file-3", 10, "index.ts"),
];

// ============================================================================
// Root View Tests
// ============================================================================

describe("TreemapGrid - root view (no zoom)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders cells for all items", () => {
    const { container } = render(
      <TreemapGrid
        items={testItems}
        zoomedId={null}
        zoomedChildren={[]}
        availableWidth={500}
        availableHeight={400}
        onCellClick={vi.fn()}
        onChildClick={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const cells = container.querySelectorAll("[data-treemap-cell]");
    expect(cells.length).toBe(3);
  });

  it("renders cell labels", () => {
    const { container } = render(
      <TreemapGrid
        items={testItems}
        zoomedId={null}
        zoomedChildren={[]}
        availableWidth={500}
        availableHeight={400}
        onCellClick={vi.fn()}
        onChildClick={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(container.textContent).toContain("no-unused-vars");
    expect(container.textContent).toContain("no-console");
    expect(container.textContent).toContain("prefer-const");
  });

  it("calls onCellClick when a cell is clicked", () => {
    const onCellClick = vi.fn();
    const { container } = render(
      <TreemapGrid
        items={testItems}
        zoomedId={null}
        zoomedChildren={[]}
        availableWidth={500}
        availableHeight={400}
        onCellClick={onCellClick}
        onChildClick={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const cells = container.querySelectorAll("[data-treemap-cell]");
    fireEvent.click(cells[0]);
    expect(onCellClick).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// Zoomed View Tests
// ============================================================================

describe("TreemapGrid - zoomed view", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows context strip when zoomed", () => {
    const { container } = render(
      <TreemapGrid
        items={testItems}
        zoomedId="rule-1"
        zoomedChildren={testChildren}
        availableWidth={500}
        availableHeight={400}
        onCellClick={vi.fn()}
        onChildClick={vi.fn()}
        onBack={vi.fn()}
      />
    );

    // Context strip should contain all rule labels
    expect(container.textContent).toContain("no-unused-vars");
    // Child cells should be rendered
    const cells = container.querySelectorAll("[data-treemap-cell]");
    expect(cells.length).toBe(3); // 3 children
  });

  it("calls onChildClick when a child cell is clicked", () => {
    const onChildClick = vi.fn();
    const { container } = render(
      <TreemapGrid
        items={testItems}
        zoomedId="rule-1"
        zoomedChildren={testChildren}
        availableWidth={500}
        availableHeight={400}
        onCellClick={vi.fn()}
        onChildClick={onChildClick}
        onBack={vi.fn()}
      />
    );

    const cells = container.querySelectorAll("[data-treemap-cell]");
    fireEvent.click(cells[0]);
    expect(onChildClick).toHaveBeenCalledTimes(1);
  });

  it("calls onBack when active strip item is clicked", () => {
    const onBack = vi.fn();
    const { container } = render(
      <TreemapGrid
        items={testItems}
        zoomedId="rule-1"
        zoomedChildren={testChildren}
        availableWidth={500}
        availableHeight={400}
        onCellClick={vi.fn()}
        onChildClick={vi.fn()}
        onBack={onBack}
      />
    );

    // Find the context strip button for the active item
    const buttons = container.querySelectorAll("button");
    // The first button in the strip should be for rule-1 (active)
    const activeButton = Array.from(buttons).find(
      (b) => b.getAttribute("title") === "no-unused-vars (42)"
    );
    expect(activeButton).toBeTruthy();
    fireEvent.click(activeButton!);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("switches to different sibling via strip click", () => {
    const onCellClick = vi.fn();
    const { container } = render(
      <TreemapGrid
        items={testItems}
        zoomedId="rule-1"
        zoomedChildren={testChildren}
        availableWidth={500}
        availableHeight={400}
        onCellClick={onCellClick}
        onChildClick={vi.fn()}
        onBack={vi.fn()}
      />
    );

    // Find button for rule-2 (non-active)
    const buttons = container.querySelectorAll("button");
    const siblingButton = Array.from(buttons).find(
      (b) => b.getAttribute("title") === "no-console (15)"
    );
    expect(siblingButton).toBeTruthy();
    fireEvent.click(siblingButton!);
    expect(onCellClick).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// Custom Render Content Tests
// ============================================================================

describe("TreemapGrid - custom render content", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses renderZoomedContent when provided", () => {
    const { container } = render(
      <TreemapGrid
        items={testItems}
        zoomedId="rule-1"
        zoomedChildren={testChildren}
        availableWidth={500}
        availableHeight={400}
        onCellClick={vi.fn()}
        onChildClick={vi.fn()}
        onBack={vi.fn()}
        renderZoomedContent={() => (
          <div data-testid="custom-content">Custom zoomed content</div>
        )}
      />
    );

    expect(container.textContent).toContain("Custom zoomed content");
    // Should not render child treemap cells
    const cells = container.querySelectorAll("[data-treemap-cell]");
    expect(cells.length).toBe(0);
  });
});

// ============================================================================
// Empty State Tests
// ============================================================================

describe("TreemapGrid - empty state", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows empty state when no items", () => {
    const { container } = render(
      <TreemapGrid
        items={[]}
        zoomedId={null}
        zoomedChildren={[]}
        availableWidth={500}
        availableHeight={400}
        onCellClick={vi.fn()}
        onChildClick={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(container.textContent).toContain("No items to display");
  });
});

// ============================================================================
// Layout Tests
// ============================================================================

describe("TreemapGrid - layout", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with correct container dimensions", () => {
    const { container } = render(
      <TreemapGrid
        items={testItems}
        zoomedId={null}
        zoomedChildren={[]}
        availableWidth={600}
        availableHeight={500}
        onCellClick={vi.fn()}
        onChildClick={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const gridContainer = container.firstChild as HTMLElement;
    expect(gridContainer.style.width).toBe("600px");
    expect(gridContainer.style.height).toBe("500px");
  });

  it("enforces minimum height", () => {
    const { container } = render(
      <TreemapGrid
        items={testItems}
        zoomedId={null}
        zoomedChildren={[]}
        availableWidth={500}
        availableHeight={50}
        onCellClick={vi.fn()}
        onChildClick={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const gridContainer = container.firstChild as HTMLElement;
    expect(gridContainer.style.minHeight).toBe("200px");
  });

  it("handles single item", () => {
    const { container } = render(
      <TreemapGrid
        items={[createTestItem("solo", 10, "Solo Rule")]}
        zoomedId={null}
        zoomedChildren={[]}
        availableWidth={500}
        availableHeight={400}
        onCellClick={vi.fn()}
        onChildClick={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const cells = container.querySelectorAll("[data-treemap-cell]");
    expect(cells.length).toBe(1);
    expect(container.textContent).toContain("Solo Rule");
  });
});

/**
 * Tests for TreemapCell component
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { TreemapCell } from "./TreemapCell";

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

// ============================================================================
// Test Helpers
// ============================================================================

const defaultProps = {
  id: "test-cell",
  label: "no-unused-vars",
  count: 42,
  x: 10,
  y: 20,
  width: 200,
  height: 150,
  areaFraction: 0.8,
  onClick: vi.fn(),
};

// ============================================================================
// Rendering Tests
// ============================================================================

describe("TreemapCell - rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders label and count for large cells", () => {
    const { container } = render(<TreemapCell {...defaultProps} />);
    expect(container.textContent).toContain("no-unused-vars");
    expect(container.textContent).toContain("42");
  });

  it("renders subtitle when present", () => {
    const { container } = render(
      <TreemapCell {...defaultProps} subtitle="src/components" />
    );
    expect(container.textContent).toContain("src/components");
  });

  it("renders file count when present", () => {
    const { container } = render(
      <TreemapCell {...defaultProps} fileCount={5} />
    );
    expect(container.textContent).toContain("5 files");
  });

  it("renders singular forms correctly", () => {
    const { container } = render(
      <TreemapCell {...defaultProps} count={1} fileCount={1} />
    );
    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("issue");
    expect(container.textContent).toContain("1 file");
  });

  it("shows compact content for medium cells", () => {
    const { container } = render(
      <TreemapCell {...defaultProps} width={80} height={60} />
    );
    // Should show label and count but not file count
    expect(container.textContent).toContain("no-unused-vars");
    expect(container.textContent).toContain("42");
  });

  it("shows minimal content (tooltip only) for small cells", () => {
    const { container } = render(
      <TreemapCell {...defaultProps} width={30} height={30} />
    );
    // Should NOT show text content inside the cell
    const cell = container.querySelector("[data-treemap-cell]");
    expect(cell).toBeTruthy();
    // Title attribute should be set for tooltip
    expect(cell?.getAttribute("title")).toBe("no-unused-vars: 42");
  });

  it("uses data-treemap-cell attribute with id", () => {
    const { container } = render(<TreemapCell {...defaultProps} />);
    const cell = container.querySelector('[data-treemap-cell="test-cell"]');
    expect(cell).toBeTruthy();
  });
});

// ============================================================================
// Severity Color Tests
// ============================================================================

describe("TreemapCell - severity colors", () => {
  afterEach(() => {
    cleanup();
  });

  it("applies error color class for error-dominant severity", () => {
    const { container } = render(
      <TreemapCell
        {...defaultProps}
        severityCounts={{ error: 10, warning: 2, info: 0 }}
      />
    );
    const cell = container.querySelector("[data-treemap-cell]");
    expect(cell?.className).toContain("bg-error/10");
  });

  it("applies warning color class for warning-dominant severity", () => {
    const { container } = render(
      <TreemapCell
        {...defaultProps}
        severityCounts={{ error: 0, warning: 10, info: 2 }}
      />
    );
    const cell = container.querySelector("[data-treemap-cell]");
    expect(cell?.className).toContain("bg-warning/10");
  });

  it("applies info color class for info-only severity", () => {
    const { container } = render(
      <TreemapCell
        {...defaultProps}
        severityCounts={{ error: 0, warning: 0, info: 10 }}
      />
    );
    const cell = container.querySelector("[data-treemap-cell]");
    expect(cell?.className).toContain("bg-info/10");
  });

  it("applies default color when no severity counts", () => {
    const { container } = render(<TreemapCell {...defaultProps} />);
    const cell = container.querySelector("[data-treemap-cell]");
    expect(cell?.className).toContain("foreground");
  });
});

// ============================================================================
// Interaction Tests
// ============================================================================

describe("TreemapCell - interactions", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    const { container } = render(
      <TreemapCell {...defaultProps} onClick={onClick} />
    );
    const cell = container.querySelector("[data-treemap-cell]");
    fireEvent.click(cell!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// Visual State Tests
// ============================================================================

describe("TreemapCell - visual states", () => {
  afterEach(() => {
    cleanup();
  });

  it("applies ring style when isZoomed", () => {
    const { container } = render(
      <TreemapCell {...defaultProps} isZoomed={true} />
    );
    const cell = container.querySelector("[data-treemap-cell]");
    expect(cell?.className).toContain("ring-1");
  });

  it("does not apply ring when not zoomed", () => {
    const { container } = render(
      <TreemapCell {...defaultProps} isZoomed={false} />
    );
    const cell = container.querySelector("[data-treemap-cell]");
    expect(cell?.className).not.toContain("ring-1");
  });

  it("sets opacity based on areaFraction", () => {
    const { container } = render(
      <TreemapCell {...defaultProps} areaFraction={1.0} />
    );
    const cell = container.querySelector("[data-treemap-cell]") as HTMLElement;
    expect(cell.style.opacity).toBe("1");
  });

  it("sets lower opacity for small areaFraction", () => {
    const { container } = render(
      <TreemapCell {...defaultProps} areaFraction={0} />
    );
    const cell = container.querySelector("[data-treemap-cell]") as HTMLElement;
    expect(cell.style.opacity).toBe("0.6");
  });
});

// ============================================================================
// Positioning Tests
// ============================================================================

describe("TreemapCell - positioning", () => {
  afterEach(() => {
    cleanup();
  });

  it("applies absolute position styles", () => {
    const { container } = render(
      <TreemapCell {...defaultProps} x={50} y={100} width={200} height={150} />
    );
    const cell = container.querySelector("[data-treemap-cell]") as HTMLElement;
    expect(cell.style.left).toBe("50px");
    expect(cell.style.top).toBe("100px");
    expect(cell.style.width).toBe("200px");
    expect(cell.style.height).toBe("150px");
  });
});

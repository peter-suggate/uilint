/**
 * Tests for Tile component styling and behavior
 *
 * The Tile component uses glassmorphic styling with rgba colors
 * for a modern iOS-like appearance.
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { Tile } from "./Tile";
import type { TileItem, TileBucket } from "../../../core/plugin-system/types";

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

const createTestItem = (overrides: Partial<TileItem> = {}): TileItem => ({
  id: "test-tile-1",
  label: "Test Rule",
  count: 5,
  ...overrides,
});

describe("Tile - styling", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses inline styles instead of Tailwind className for the root element", () => {
    const { container } = render(
      <Tile
        item={createTestItem()}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root).toBeTruthy();

    // Should have inline styles for layout
    expect(root.style.padding).toBeTruthy();
    expect(root.style.cursor).toBe("pointer");
    expect(root.style.display).toBe("flex");
    expect(root.style.borderRadius).toBeTruthy();

    // Should NOT have Tailwind utility classes
    const classAttr = root.getAttribute("class") || "";
    const hasTailwindClasses = /\b(px-|py-|gap-|flex|items-|border-|bg-|cursor-|text-\[)\b/.test(classAttr);
    expect(hasTailwindClasses).toBe(false);
  });

  it("uses glassmorphic styling with rgba colors", () => {
    const { container } = render(
      <Tile
        item={createTestItem()}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    const style = root.getAttribute("style") || "";

    // Should use rgba for glassmorphic effect
    expect(style).toContain("rgba(255, 255, 255");
    // Should have semi-transparent background
    expect(style).toContain("0.08)");
    // Should have border radius for glass card look
    expect(style).toContain("border-radius: 16px");
  });
});

describe("Tile - rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders label and count correctly", () => {
    const { container } = render(
      <Tile
        item={createTestItem({ label: "My Rule Name", count: 42 })}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    // Check that label is rendered
    expect(container.textContent).toContain("My Rule Name");
    // Check that count is rendered
    expect(container.textContent).toContain("42");
  });

  it("renders severity dots when severityCounts provided", () => {
    const { container } = render(
      <Tile
        item={createTestItem({
          severityCounts: { error: 3, warning: 2, info: 1 },
        })}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    // Look for severity dot indicators (6px circles)
    const allElements = container.querySelectorAll("*");
    let severityDotsFound = false;

    allElements.forEach((el) => {
      const style = el.getAttribute("style");
      if (style && style.includes("width: 6px") && style.includes("border-radius: 50%")) {
        severityDotsFound = true;
      }
    });

    expect(severityDotsFound).toBe(true);
  });

  it("does not render severity indicators when severityCounts not provided", () => {
    const { container } = render(
      <Tile
        item={createTestItem({ severityCounts: undefined })}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    // Look for severity dot indicators
    const allElements = container.querySelectorAll("*");
    let severityDotsFound = false;

    allElements.forEach((el) => {
      const style = el.getAttribute("style");
      if (style && style.includes("#ff6b6b") || style?.includes("#ffd93d") || style?.includes("#74b9ff")) {
        severityDotsFound = true;
      }
    });

    expect(severityDotsFound).toBe(false);
  });

  it("renders subtitle when provided for non-compact bucket", () => {
    const { container } = render(
      <Tile
        item={createTestItem({ subtitle: "Additional info here" })}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    expect(container.textContent).toContain("Additional info here");
  });

  it("does not render subtitle for xs bucket even when provided", () => {
    const { container } = render(
      <Tile
        item={createTestItem({ subtitle: "Hidden subtitle" })}
        bucket="xs"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    expect(container.textContent).not.toContain("Hidden subtitle");
  });

  it("does not render subtitle for sm bucket even when provided", () => {
    const { container } = render(
      <Tile
        item={createTestItem({ subtitle: "Hidden subtitle" })}
        bucket="sm"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    expect(container.textContent).not.toContain("Hidden subtitle");
  });
});

describe("Tile - selected state", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows selected state styling when isSelected=true", () => {
    const { container } = render(
      <Tile
        item={createTestItem()}
        bucket="md"
        isSelected={true}
        onClick={vi.fn()}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    const style = root.getAttribute("style") || "";

    // Selected state should have brighter background (0.15 vs 0.08)
    expect(style).toContain("rgba(255, 255, 255, 0.15)");
    // And brighter border (0.3 vs 0.1)
    expect(style).toContain("rgba(255, 255, 255, 0.3)");
  });

  it("shows non-selected state styling when isSelected=false", () => {
    const { container } = render(
      <Tile
        item={createTestItem()}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    const style = root.getAttribute("style") || "";

    // Non-selected state should have subtle background (0.08)
    expect(style).toContain("rgba(255, 255, 255, 0.08)");
    // And subtle border (0.1)
    expect(style).toContain("rgba(255, 255, 255, 0.1)");
  });
});

describe("Tile - interactions", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    const { container } = render(
      <Tile
        item={createTestItem()}
        bucket="md"
        isSelected={false}
        onClick={onClick}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    fireEvent.click(root);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("Tile - bucket styling", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses height: 100% since parent controls height", () => {
    const { container } = render(
      <Tile
        item={createTestItem()}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.style.height).toBe("100%");
  });

  it("applies compact padding for xs bucket", () => {
    const { container } = render(
      <Tile
        item={createTestItem()}
        bucket="xs"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.style.padding).toBe("12px 14px");
  });

  it("applies compact padding for sm bucket", () => {
    const { container } = render(
      <Tile
        item={createTestItem()}
        bucket="sm"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.style.padding).toBe("12px 14px");
  });

  it("applies standard padding for md bucket", () => {
    const { container } = render(
      <Tile
        item={createTestItem()}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.style.padding).toBe("16px 20px");
  });

  it("applies standard padding for lg bucket", () => {
    const { container } = render(
      <Tile
        item={createTestItem()}
        bucket="lg"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.style.padding).toBe("16px 20px");
  });
});

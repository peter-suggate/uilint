/**
 * Tests for Tile component styling and behavior
 *
 * The Tile component uses shadcn-style Tailwind classes with cva variants
 * for a modern glassmorphic appearance.
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

  it("uses Tailwind className with cva variants for styling", () => {
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

    // Should have Tailwind/cva classes for glassmorphic styling
    const classAttr = root.getAttribute("class") || "";
    expect(classAttr).toContain("cursor-pointer");
    expect(classAttr).toContain("rounded-2xl");
    expect(classAttr).toContain("flex");
    expect(classAttr).toContain("flex-col");
  });

  it("uses glassmorphic styling classes with backdrop blur", () => {
    const { container } = render(
      <Tile
        item={createTestItem()}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    const classAttr = root.getAttribute("class") || "";

    // Should have backdrop blur for glassmorphic effect
    expect(classAttr).toContain("backdrop-blur");
    expect(classAttr).toContain("backdrop-saturate");
    // Should have glass background classes
    expect(classAttr).toContain("bg-glass");
    // Should have border for glass card look
    expect(classAttr).toContain("border");
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

    // Look for severity dot indicators (w-1.5 h-1.5 rounded-full with color classes)
    const allElements = container.querySelectorAll("*");
    let severityDotsFound = false;

    allElements.forEach((el) => {
      const classAttr = el.getAttribute("class") || "";
      if (classAttr.includes("rounded-full") && classAttr.includes("bg-")) {
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

    // Look for severity dot indicator classes
    const allElements = container.querySelectorAll("*");
    let severityDotsFound = false;

    allElements.forEach((el) => {
      const classAttr = el.getAttribute("class") || "";
      if (classAttr.includes("bg-error") || classAttr.includes("bg-warning") || classAttr.includes("bg-info")) {
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
    const classAttr = root.getAttribute("class") || "";

    // Selected state should have bg-glass-medium class (not light)
    expect(classAttr).toContain("bg-glass-medium");
    // And full border opacity
    expect(classAttr).toContain("border-glass-border");
    expect(classAttr).not.toContain("border-glass-border/50");
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
    const classAttr = root.getAttribute("class") || "";

    // Non-selected state should have bg-glass-light class
    expect(classAttr).toContain("bg-glass-light");
    // And subtle border with opacity
    expect(classAttr).toContain("border-glass-border/50");
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

  it("uses h-full class since parent controls height", () => {
    const { container } = render(
      <Tile
        item={createTestItem()}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    const classAttr = root.getAttribute("class") || "";
    expect(classAttr).toContain("h-full");
  });

  it("applies compact padding class for xs bucket", () => {
    const { container } = render(
      <Tile
        item={createTestItem()}
        bucket="xs"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    const classAttr = root.getAttribute("class") || "";
    expect(classAttr).toContain("p-3");
  });

  it("applies compact padding class for sm bucket", () => {
    const { container } = render(
      <Tile
        item={createTestItem()}
        bucket="sm"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    const classAttr = root.getAttribute("class") || "";
    expect(classAttr).toContain("p-3.5");
  });

  it("applies standard padding class for md bucket", () => {
    const { container } = render(
      <Tile
        item={createTestItem()}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    const classAttr = root.getAttribute("class") || "";
    expect(classAttr).toContain("p-4");
  });

  it("applies larger padding class for lg bucket", () => {
    const { container } = render(
      <Tile
        item={createTestItem()}
        bucket="lg"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    const classAttr = root.getAttribute("class") || "";
    expect(classAttr).toContain("p-5");
  });
});

/**
 * Tests for Tile component styling and behavior
 *
 * The Tile component uses inline styles with CSS variables (var(--uilint-*))
 * instead of Tailwind classes to ensure proper styling in the devtools overlay
 * where Tailwind is not available.
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

  it("uses CSS variables for colors (var(--uilint-*))", () => {
    const { container } = render(
      <Tile
        item={createTestItem()}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    // Collect all style attributes in the tree
    const allElements = container.querySelectorAll("*");
    const styleStrings: string[] = [];
    allElements.forEach((el) => {
      const style = el.getAttribute("style");
      if (style) styleStrings.push(style);
    });

    // At least some elements should use CSS variables for theming
    const usesCSSVars = styleStrings.some((s) => s.includes("var(--uilint-"));
    expect(usesCSSVars).toBe(true);
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

  it("renders severity bar when severityCounts provided", () => {
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

    // Look for the severity bar container (height: 4px)
    const allElements = container.querySelectorAll("*");
    let severityBarFound = false;

    allElements.forEach((el) => {
      const style = el.getAttribute("style");
      if (style && style.includes("height: 4px") || style?.includes("height:4px")) {
        severityBarFound = true;
        // Check that it contains colored segments using CSS variables
        const children = el.querySelectorAll("div");
        expect(children.length).toBeGreaterThan(0);
      }
    });

    expect(severityBarFound).toBe(true);
  });

  it("does not render severity bar when severityCounts not provided", () => {
    const { container } = render(
      <Tile
        item={createTestItem({ severityCounts: undefined })}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    // Look for the severity bar container (height: 4px)
    const allElements = container.querySelectorAll("*");
    let severityBarFound = false;

    allElements.forEach((el) => {
      const style = el.getAttribute("style");
      if (style && (style.includes("height: 4px") || style.includes("height:4px"))) {
        severityBarFound = true;
      }
    });

    expect(severityBarFound).toBe(false);
  });

  it("renders subtitle when provided for non-xs bucket", () => {
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

  it("renders icon when provided", () => {
    const { container } = render(
      <Tile
        item={createTestItem({ icon: "🔥" })}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    expect(container.textContent).toContain("🔥");
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

    // Selected state should have accent border and info-bg background
    expect(style).toContain("var(--uilint-accent)");
    expect(style).toContain("var(--uilint-info-bg)");
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

    // Non-selected state should have surface-elevated background
    expect(style).toContain("var(--uilint-surface-elevated)");
    expect(style).toContain("var(--uilint-border)");
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

describe("Tile - bucket sizes", () => {
  afterEach(() => {
    cleanup();
  });

  const bucketHeights: Record<TileBucket, number> = {
    xs: 60,
    sm: 80,
    md: 110,
    lg: 150,
    xl: 200,
  };

  it.each(Object.entries(bucketHeights))(
    "applies correct height for bucket size %s (%dpx)",
    (bucket, expectedHeight) => {
      const { container } = render(
        <Tile
          item={createTestItem()}
          bucket={bucket as TileBucket}
          isSelected={false}
          onClick={vi.fn()}
        />
      );

      const root = container.firstElementChild as HTMLElement;
      expect(root.style.height).toBe(`${expectedHeight}px`);
    }
  );

  it("applies smaller padding for xs bucket", () => {
    const { container: xsContainer } = render(
      <Tile
        item={createTestItem()}
        bucket="xs"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    const { container: mdContainer } = render(
      <Tile
        item={createTestItem({ id: "test-tile-2" })}
        bucket="md"
        isSelected={false}
        onClick={vi.fn()}
      />
    );

    const xsRoot = xsContainer.firstElementChild as HTMLElement;
    const mdRoot = mdContainer.firstElementChild as HTMLElement;

    // xs should have "10px 12px" padding
    expect(xsRoot.style.padding).toBe("10px 12px");
    // md should have "14px 16px" padding
    expect(mdRoot.style.padding).toBe("14px 16px");
  });
});

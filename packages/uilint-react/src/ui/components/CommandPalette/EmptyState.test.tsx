/**
 * Tests for EmptyState component
 *
 * EmptyState displays elegant illustrations and messaging when there are
 * no tiles to show. The devtools overlay doesn't have Tailwind loaded, so
 * all styling must use inline styles with CSS variables (var(--uilint-*)).
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

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

describe("EmptyState - variants", () => {
  afterEach(() => {
    cleanup();
  });

  it('renders "No matches found" for variant="no-results"', () => {
    const { container } = render(<EmptyState variant="no-results" />);

    expect(container.textContent).toContain("No matches found");
    expect(container.textContent).toContain("Try different keywords");
  });

  it('renders "Looking good!" for variant="no-issues"', () => {
    const { container } = render(<EmptyState variant="no-issues" />);

    expect(container.textContent).toContain("Looking good!");
    expect(container.textContent).toContain("No issues detected");
  });

  it('renders "No items match current filters" for variant="filtered-empty"', () => {
    const { container } = render(
      <EmptyState variant="filtered-empty" onClearFilters={vi.fn()} />
    );

    expect(container.textContent).toContain("No items match current filters");
  });

  it('renders "Clear filters" button for filtered-empty variant', () => {
    const { container } = render(
      <EmptyState variant="filtered-empty" onClearFilters={vi.fn()} />
    );

    const button = container.querySelector("button");
    expect(button).toBeTruthy();
    expect(button?.textContent).toBe("Clear filters");
  });

  it("does not render Clear filters button when onClearFilters is not provided", () => {
    const { container } = render(<EmptyState variant="filtered-empty" />);

    const button = container.querySelector("button");
    expect(button).toBeNull();
  });

  it("calls onClearFilters when Clear filters button is clicked", () => {
    const onClearFilters = vi.fn();
    const { container } = render(
      <EmptyState variant="filtered-empty" onClearFilters={onClearFilters} />
    );

    const button = container.querySelector("button");
    expect(button).toBeTruthy();

    fireEvent.click(button!);
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});

describe("EmptyState - styling", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses inline styles instead of Tailwind classes", () => {
    const { container } = render(<EmptyState variant="no-results" />);

    // The root element should use style attribute, not className with Tailwind
    const root = container.firstElementChild as HTMLElement;
    expect(root).toBeTruthy();

    // Should have inline styles for layout
    expect(root.style.display).toBe("flex");
    expect(root.style.flexDirection).toBe("column");
    expect(root.style.alignItems).toBe("center");
    expect(root.style.justifyContent).toBe("center");

    // Should NOT have Tailwind utility classes
    const classAttr = root.getAttribute("class") || "";
    const hasTailwindClasses = /\b(px-|py-|gap-|flex|items-|justify-|text-center|min-h-)\b/.test(classAttr);
    expect(hasTailwindClasses).toBe(false);
  });

  it("uses CSS variables for colors (var(--uilint-*))", () => {
    const { container } = render(<EmptyState variant="no-issues" />);

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

  it("Clear filters button uses inline styles, not Tailwind classes", () => {
    const { container } = render(
      <EmptyState variant="filtered-empty" onClearFilters={vi.fn()} />
    );

    const button = container.querySelector("button");
    expect(button).toBeTruthy();

    // Button should have inline styles
    expect(button?.style.padding).toBeTruthy();
    expect(button?.style.fontSize).toBeTruthy();
    expect(button?.style.cursor).toBe("pointer");

    // Should NOT have Tailwind utility classes
    const classAttr = button?.getAttribute("class") || "";
    const hasTailwindClasses = /\b(px-|py-|text-|font-|bg-|border-|rounded|cursor-)\b/.test(classAttr);
    expect(hasTailwindClasses).toBe(false);
  });

  it("no-results variant renders magnifying glass illustration", () => {
    const { container } = render(<EmptyState variant="no-results" />);

    // The illustration should be present (contains decorative elements)
    const divElements = container.querySelectorAll("div");
    expect(divElements.length).toBeGreaterThan(1);
  });

  it("no-issues variant renders checkmark illustration with SVG", () => {
    const { container } = render(<EmptyState variant="no-issues" />);

    // Should have an SVG element for the checkmark
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("filtered-empty variant renders filter illustration", () => {
    const { container } = render(
      <EmptyState variant="filtered-empty" onClearFilters={vi.fn()} />
    );

    // The illustration should have multiple div elements for the filter shape
    const divElements = container.querySelectorAll("div");
    expect(divElements.length).toBeGreaterThan(1);
  });
});

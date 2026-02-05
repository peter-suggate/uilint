/**
 * Tests for EmptyState component
 *
 * EmptyState displays elegant illustrations and messaging when there are
 * no tiles to show. Uses Tailwind classes for styling.
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

describe("EmptyState - illustrations", () => {
  afterEach(() => {
    cleanup();
  });

  it("no-results variant renders search icon", () => {
    const { container } = render(<EmptyState variant="no-results" />);

    // Should have an SVG element for the search icon
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("no-issues variant renders checkmark icon", () => {
    const { container } = render(<EmptyState variant="no-issues" />);

    // Should have an SVG element for the checkmark
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("filtered-empty variant renders filter icon", () => {
    const { container } = render(
      <EmptyState variant="filtered-empty" onClearFilters={vi.fn()} />
    );

    // Should have SVG elements for the filter icons
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
  });
});

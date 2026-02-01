/**
 * Tests for FilterChip component styling
 *
 * FilterChip displays active filters as removable pills with color coding
 * by filter type. The devtools overlay doesn't have Tailwind loaded, so
 * all styling must use inline styles with CSS variables (var(--uilint-*)).
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { FilterChip } from "./FilterChip";
import type { TileFilter } from "../../../core/plugin-system/types";

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

// Test filters for different types
const scopeFilter: TileFilter = {
  type: "scope",
  id: "scope-viewport",
  label: "viewport",
};

const ruleFilter: TileFilter = {
  type: "rule",
  id: "uilint/semantic",
  label: "semantic",
};

const fileFilter: TileFilter = {
  type: "file",
  id: "file-app.tsx",
  label: "App.tsx",
};

const severityFilter: TileFilter = {
  type: "severity",
  id: "severity-error",
  label: "error",
};

const categoryFilter: TileFilter = {
  type: "category",
  id: "category-accessibility",
  label: "accessibility",
};

describe("FilterChip - styling", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses inline styles instead of Tailwind className", () => {
    const { container } = render(
      <FilterChip filter={scopeFilter} onRemove={vi.fn()} />
    );

    // The root element should use style attribute, not className with Tailwind
    const root = container.firstElementChild as HTMLElement;
    expect(root).toBeTruthy();

    // Should have inline styles for layout
    expect(root.style.display).toBe("inline-flex");
    expect(root.style.alignItems).toBe("center");
    expect(root.style.borderRadius).toBeTruthy();

    // Should NOT have Tailwind utility classes
    const classAttr = root.getAttribute("class") || "";
    const hasTailwindClasses = /\b(px-|py-|gap-|flex|items-|border-|bg-|cursor-|text-\[|inline-flex|rounded)\b/.test(classAttr);
    expect(hasTailwindClasses).toBe(false);
  });

  it("uses CSS variables for colors (var(--uilint-*))", () => {
    const { container } = render(
      <FilterChip filter={ruleFilter} onRemove={vi.fn()} />
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

  it("renders the filter label correctly", () => {
    const { container } = render(
      <FilterChip filter={scopeFilter} onRemove={vi.fn()} />
    );

    expect(container.textContent).toContain("viewport");
  });

  it("applies blue color for scope filter type", () => {
    const { container } = render(
      <FilterChip filter={scopeFilter} onRemove={vi.fn()} />
    );

    const root = container.firstElementChild as HTMLElement;
    const styleAttr = root.getAttribute("style") || "";

    // Scope filters should have blue tint (59, 130, 246 is blue)
    expect(styleAttr).toContain("rgba(59, 130, 246");
  });

  it("applies purple color for rule filter type", () => {
    const { container } = render(
      <FilterChip filter={ruleFilter} onRemove={vi.fn()} />
    );

    const root = container.firstElementChild as HTMLElement;
    const styleAttr = root.getAttribute("style") || "";

    // Rule filters should have purple tint (147, 51, 234 is purple)
    expect(styleAttr).toContain("rgba(147, 51, 234");
  });

  it("applies green color for file filter type", () => {
    const { container } = render(
      <FilterChip filter={fileFilter} onRemove={vi.fn()} />
    );

    const root = container.firstElementChild as HTMLElement;
    const styleAttr = root.getAttribute("style") || "";

    // File filters should have green tint (34, 197, 94 is green)
    expect(styleAttr).toContain("rgba(34, 197, 94");
  });

  it("applies amber/yellow color for severity filter type", () => {
    const { container } = render(
      <FilterChip filter={severityFilter} onRemove={vi.fn()} />
    );

    const root = container.firstElementChild as HTMLElement;
    const styleAttr = root.getAttribute("style") || "";

    // Severity filters should have amber/yellow tint (245, 158, 11 is amber)
    expect(styleAttr).toContain("rgba(245, 158, 11");
  });

  it("applies gray color for category filter type", () => {
    const { container } = render(
      <FilterChip filter={categoryFilter} onRemove={vi.fn()} />
    );

    const root = container.firstElementChild as HTMLElement;
    const styleAttr = root.getAttribute("style") || "";

    // Category filters should use CSS variable for surface color
    expect(styleAttr).toContain("var(--uilint-");
  });

  it("calls onRemove when the remove button is clicked", () => {
    const onRemove = vi.fn();
    const { container } = render(
      <FilterChip filter={scopeFilter} onRemove={onRemove} />
    );

    // Find the remove button (contains "×")
    const removeButton = container.querySelector("button");
    expect(removeButton).toBeTruthy();

    fireEvent.click(removeButton!);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onRemove when the chip body is clicked (only remove button)", () => {
    const onRemove = vi.fn();
    const { container } = render(
      <FilterChip filter={scopeFilter} onRemove={onRemove} />
    );

    // Click on the root container (chip body), not the button
    const root = container.firstElementChild as HTMLElement;
    fireEvent.click(root);

    // onRemove should NOT be called when clicking the chip body
    expect(onRemove).not.toHaveBeenCalled();

    // But it should be called when clicking the button
    const removeButton = container.querySelector("button");
    fireEvent.click(removeButton!);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("remove button has accessible aria-label", () => {
    const { container } = render(
      <FilterChip filter={scopeFilter} onRemove={vi.fn()} />
    );

    const removeButton = container.querySelector("button");
    expect(removeButton).toBeTruthy();
    expect(removeButton?.getAttribute("aria-label")).toBe("Remove viewport filter");
  });
});

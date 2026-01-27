/**
 * Tests for RuleItem component styling
 *
 * Bug #3: RuleItem uses Tailwind CSS className attributes instead of inline
 * styles with CSS variables. The devtools overlay doesn't have Tailwind loaded,
 * so these classes render unstyled. All other CommandPalette components use
 * inline styles with CSS variables (var(--uilint-*)).
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { RuleItem } from "./RuleItem";
import type { RuleDefinition } from "../../../core/plugin-system/types";

// Mock motion/react in case any sub-component imports it
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

const testRule: RuleDefinition = {
  id: "uilint/no-console",
  name: "No Console",
  description: "Disallow console statements",
  category: "static",
  severity: "warning",
  fixable: false,
  pluginId: "eslint",
};

describe("RuleItem - styling", () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * Bug #3: RuleItem uses Tailwind className attributes (e.g., "px-4 py-2.5")
   * instead of inline styles with CSS variables. In the devtools overlay context,
   * Tailwind is not available, so these classes have no effect.
   *
   * The component should use inline styles like all other CommandPalette components.
   */
  it("uses inline styles instead of Tailwind className for the root element", () => {
    const { container } = render(
      <RuleItem
        rule={testRule}
        issueCount={3}
        isSelected={false}
        onSeverityChange={vi.fn()}
        onClick={vi.fn()}
      />
    );

    // The root element should use style attribute, not className with Tailwind
    const root = container.firstElementChild as HTMLElement;
    expect(root).toBeTruthy();

    // Should have inline styles for layout
    expect(root.style.padding).toBeTruthy();
    expect(root.style.cursor).toBe("pointer");
    expect(root.style.display).toBe("flex");

    // Should NOT have Tailwind utility classes
    const classAttr = root.getAttribute("class") || "";
    const hasTailwindClasses = /\b(px-|py-|gap-|flex|items-|border-|bg-|cursor-|text-\[)\b/.test(classAttr);
    expect(hasTailwindClasses).toBe(false);
  });

  it("uses inline styles for severity toggle buttons instead of Tailwind classes", () => {
    const { container } = render(
      <RuleItem
        rule={testRule}
        issueCount={0}
        isSelected={false}
        onSeverityChange={vi.fn()}
        onClick={vi.fn()}
      />
    );

    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);

    buttons.forEach((button) => {
      const classAttr = button.getAttribute("class") || "";
      const hasTailwindClasses = /\b(px-|py-|text-\[|font-|border-|rounded|bg-)\b/.test(classAttr);
      expect(hasTailwindClasses).toBe(false);
    });
  });

  it("uses CSS variables for colors (var(--uilint-*))", () => {
    const { container } = render(
      <RuleItem
        rule={testRule}
        issueCount={0}
        isSelected={false}
        onSeverityChange={vi.fn()}
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

  it("calls onClick when the rule item is clicked", () => {
    const onClick = vi.fn();
    const { container } = render(
      <RuleItem
        rule={testRule}
        issueCount={0}
        isSelected={false}
        onSeverityChange={vi.fn()}
        onClick={onClick}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    fireEvent.click(root);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("calls onSeverityChange with correct args when severity button clicked", () => {
    const onSeverityChange = vi.fn();
    const { container } = render(
      <RuleItem
        rule={testRule}
        issueCount={0}
        isSelected={false}
        onSeverityChange={onSeverityChange}
        onClick={vi.fn()}
      />
    );

    // Find severity buttons by their text
    const buttons = container.querySelectorAll("button");
    // Click the "E" (error) button
    const errorButton = Array.from(buttons).find(
      (b) => b.textContent === "E"
    );
    expect(errorButton).toBeTruthy();
    fireEvent.click(errorButton!);

    expect(onSeverityChange).toHaveBeenCalledWith("uilint/no-console", "error");
  });
});

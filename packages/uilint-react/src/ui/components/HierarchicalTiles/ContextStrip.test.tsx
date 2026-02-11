/**
 * Tests for ContextStrip component
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { ContextStrip, type ContextStripItem } from "./ContextStrip";

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
// Test Data
// ============================================================================

const testItems: ContextStripItem[] = [
  { id: "rule-a", label: "no-unused-vars", count: 42, severityCounts: { error: 10, warning: 30, info: 2 } },
  { id: "rule-b", label: "no-console", count: 15, severityCounts: { error: 0, warning: 15, info: 0 } },
  { id: "rule-c", label: "prefer-const", count: 8, severityCounts: { error: 0, warning: 0, info: 8 } },
];

// ============================================================================
// Rendering Tests
// ============================================================================

describe("ContextStrip - rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders all items", () => {
    const { container } = render(
      <ContextStrip items={testItems} activeId="rule-a" onItemClick={vi.fn()} />
    );
    expect(container.querySelectorAll("button").length).toBe(3);
  });

  it("returns null for empty items", () => {
    const { container } = render(
      <ContextStrip items={[]} activeId="rule-a" onItemClick={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows labels on items with sufficient width", () => {
    const { container } = render(
      <ContextStrip items={testItems} activeId="rule-a" onItemClick={vi.fn()} />
    );
    // The largest item should get enough width to show its label
    expect(container.textContent).toContain("no-unused-vars");
  });
});

// ============================================================================
// Active State Tests
// ============================================================================

describe("ContextStrip - active state", () => {
  afterEach(() => {
    cleanup();
  });

  it("highlights the active item with ring style", () => {
    const { container } = render(
      <ContextStrip items={testItems} activeId="rule-a" onItemClick={vi.fn()} />
    );
    const buttons = container.querySelectorAll("button");
    // First button (rule-a) should have the active ring
    const activeButton = Array.from(buttons).find((b) =>
      b.className.includes("ring-1")
    );
    expect(activeButton).toBeTruthy();
  });

  it("non-active items have reduced opacity", () => {
    const { container } = render(
      <ContextStrip items={testItems} activeId="rule-a" onItemClick={vi.fn()} />
    );
    const buttons = container.querySelectorAll("button");
    // Non-active buttons should have opacity class
    const nonActiveButtons = Array.from(buttons).filter(
      (b) => !b.className.includes("ring-1")
    );
    expect(nonActiveButtons.length).toBe(2);
    for (const btn of nonActiveButtons) {
      expect(btn.className).toContain("opacity-70");
    }
  });
});

// ============================================================================
// Interaction Tests
// ============================================================================

describe("ContextStrip - interactions", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onItemClick with correct id when item is clicked", () => {
    const onItemClick = vi.fn();
    const { container } = render(
      <ContextStrip items={testItems} activeId="rule-a" onItemClick={onItemClick} />
    );
    const buttons = container.querySelectorAll("button");
    fireEvent.click(buttons[1]); // Click second item
    expect(onItemClick).toHaveBeenCalledWith("rule-b");
  });

  it("calls onItemClick for each distinct button", () => {
    const onItemClick = vi.fn();
    const { container } = render(
      <ContextStrip items={testItems} activeId="rule-a" onItemClick={onItemClick} />
    );
    const buttons = container.querySelectorAll("button");
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    fireEvent.click(buttons[2]);
    expect(onItemClick).toHaveBeenCalledTimes(3);
    expect(onItemClick).toHaveBeenCalledWith("rule-a");
    expect(onItemClick).toHaveBeenCalledWith("rule-b");
    expect(onItemClick).toHaveBeenCalledWith("rule-c");
  });
});

// ============================================================================
// Proportional Width Tests
// ============================================================================

describe("ContextStrip - proportional widths", () => {
  afterEach(() => {
    cleanup();
  });

  it("gives larger items more width", () => {
    const { container } = render(
      <ContextStrip items={testItems} activeId="rule-a" onItemClick={vi.fn()} />
    );
    const buttons = container.querySelectorAll("button");

    // Items are rendered in order: rule-a (42), rule-b (15), rule-c (8)
    const widthA = parseFloat((buttons[0] as HTMLElement).style.width);
    const widthB = parseFloat((buttons[1] as HTMLElement).style.width);
    const widthC = parseFloat((buttons[2] as HTMLElement).style.width);

    // rule-a should be wider than rule-b, which should be wider than rule-c
    expect(widthA).toBeGreaterThan(widthB);
    expect(widthB).toBeGreaterThan(widthC);
  });

  it("enforces minimum width for small items", () => {
    const items: ContextStripItem[] = [
      { id: "big", label: "Big Rule", count: 1000 },
      { id: "tiny", label: "Tiny", count: 1 },
    ];
    const { container } = render(
      <ContextStrip items={items} activeId="big" onItemClick={vi.fn()} />
    );
    const buttons = container.querySelectorAll("button");
    const tinyWidth = parseFloat((buttons[1] as HTMLElement).style.width);
    // Minimum width should be at least 32px
    expect(tinyWidth).toBeGreaterThanOrEqual(32);
  });
});

// ============================================================================
// Tooltip Tests
// ============================================================================

describe("ContextStrip - tooltips", () => {
  afterEach(() => {
    cleanup();
  });

  it("sets title attribute on items", () => {
    const { container } = render(
      <ContextStrip items={testItems} activeId="rule-a" onItemClick={vi.fn()} />
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons[0].getAttribute("title")).toBe("no-unused-vars (42)");
    expect(buttons[1].getAttribute("title")).toBe("no-console (15)");
  });
});

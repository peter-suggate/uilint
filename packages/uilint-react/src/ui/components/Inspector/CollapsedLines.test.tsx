/**
 * Tests for CollapsedLines component
 *
 * CollapsedLines displays a clickable row that shows "Show N hidden lines"
 * allowing users to expand collapsed sections of source code.
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { CollapsedLines } from "./CollapsedLines";

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

describe("CollapsedLines", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with correct line count for single line", () => {
    const { container } = render(
      <CollapsedLines
        startLine={5}
        endLine={5}
        lineCount={1}
        onExpand={vi.fn()}
      />
    );

    expect(container.textContent).toContain("Show 1 hidden line");
    expect(container.textContent).toContain("(5–5)");
  });

  it("renders with correct line count for multiple lines", () => {
    const { container } = render(
      <CollapsedLines
        startLine={10}
        endLine={25}
        lineCount={16}
        onExpand={vi.fn()}
      />
    );

    expect(container.textContent).toContain("Show 16 hidden lines");
    expect(container.textContent).toContain("(10–25)");
  });

  it("calls onExpand when clicked", () => {
    const onExpand = vi.fn();
    const { container } = render(
      <CollapsedLines
        startLine={1}
        endLine={10}
        lineCount={10}
        onExpand={onExpand}
      />
    );

    const button = container.querySelector("button");
    expect(button).toBeTruthy();

    fireEvent.click(button!);
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it("renders as a button element", () => {
    const { container } = render(
      <CollapsedLines
        startLine={1}
        endLine={10}
        lineCount={10}
        onExpand={vi.fn()}
      />
    );

    const button = container.querySelector("button");
    expect(button).toBeTruthy();
    expect(button?.getAttribute("type")).toBe("button");
  });

  it("respects custom gutterWidth", () => {
    const { container } = render(
      <CollapsedLines
        startLine={1}
        endLine={10}
        lineCount={10}
        onExpand={vi.fn()}
        gutterWidth={60}
      />
    );

    // Find the gutter spacer (first span)
    const spans = container.querySelectorAll("span");
    const gutterSpan = spans[0];
    expect(gutterSpan?.style.width).toBe("60px");
  });

  it("applies custom className", () => {
    const { container } = render(
      <CollapsedLines
        startLine={1}
        endLine={10}
        lineCount={10}
        onExpand={vi.fn()}
        className="custom-class"
      />
    );

    const button = container.querySelector("button");
    expect(button?.className).toContain("custom-class");
  });
});

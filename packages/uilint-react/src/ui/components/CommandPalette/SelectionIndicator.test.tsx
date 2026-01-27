/**
 * Tests for keyboard selection scroll behavior in CommandPalette
 * @vitest-environment jsdom
 *
 * Regression: when navigating with arrow keys in the command bar,
 * the scrollable list did not scroll to keep the selected item visible.
 * The fix adds a useScrollSelectedIntoView hook that is consumed by
 * CommandPalette to auto-scroll on selectedIndex changes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import React from "react";
import { useScrollSelectedIntoView } from "./useScrollSelectedIntoView";

/**
 * Test harness that uses the real hook extracted from CommandPalette.
 * Mirrors the keyboard navigation + scroll contract:
 *   ArrowDown/Up update selectedIndex → hook scrolls the element into view.
 */
function TestList({ items }: { items: string[] }) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const itemRefs = useScrollSelectedIntoView(selectedIndex);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
    },
    [items.length]
  );

  return (
    <div
      data-testid="scroll-container"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{ maxHeight: 100, overflowY: "auto" }}
    >
      {items.map((item, index) => (
        <div
          key={item}
          ref={(el) => {
            if (el) itemRefs.current.set(index, el);
            else itemRefs.current.delete(index);
          }}
          data-testid={`item-${index}`}
          data-selected={index === selectedIndex}
          style={{ height: 40 }}
        >
          {item}
        </div>
      ))}
    </div>
  );
}

describe("useScrollSelectedIntoView", () => {
  const items = Array.from({ length: 20 }, (_, i) => `Item ${i}`);

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    // jsdom doesn't implement scrollIntoView – mock it so we can assert
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("calls scrollIntoView on ArrowDown navigation", () => {
    const { getByTestId } = render(<TestList items={items} />);

    const container = getByTestId("scroll-container");
    act(() => {
      container.focus();
    });

    fireEvent.keyDown(container, { key: "ArrowDown" });

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
    });
  });

  it("calls scrollIntoView for each step when navigating many items", () => {
    const { getByTestId } = render(<TestList items={items} />);

    const container = getByTestId("scroll-container");
    act(() => {
      container.focus();
    });

    for (let i = 0; i < 10; i++) {
      fireEvent.keyDown(container, { key: "ArrowDown" });
    }

    // Called once per step (initial render + 10 key presses)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(11);
  });

  it("calls scrollIntoView on ArrowUp navigation", () => {
    const { getByTestId } = render(<TestList items={items} />);

    const container = getByTestId("scroll-container");
    act(() => {
      container.focus();
    });

    // Navigate down first
    for (let i = 0; i < 10; i++) {
      fireEvent.keyDown(container, { key: "ArrowDown" });
    }

    (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();

    // Navigate up
    for (let i = 0; i < 5; i++) {
      fireEvent.keyDown(container, { key: "ArrowUp" });
    }

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(5);

    const item5 = getByTestId("item-5");
    expect(item5.dataset.selected).toBe("true");
  });

  it("uses block: 'nearest' to minimize scroll displacement", () => {
    const { getByTestId } = render(<TestList items={items} />);

    const container = getByTestId("scroll-container");
    act(() => {
      container.focus();
    });

    fireEvent.keyDown(container, { key: "ArrowDown" });

    const calls = (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mock.calls;
    // Every call should use { block: "nearest" }
    for (const call of calls) {
      expect(call[0]).toEqual({ block: "nearest" });
    }
  });
});

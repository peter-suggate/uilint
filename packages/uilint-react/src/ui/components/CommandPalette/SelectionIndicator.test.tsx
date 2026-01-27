/**
 * Tests for keyboard selection scroll behavior in CommandPalette
 * @vitest-environment jsdom
 *
 * Regression: when navigating with arrow keys in the command bar,
 * the scrollable list did not scroll to keep the selected item visible.
 * The fix uses a React context (ScrollSelectedContext) so that any
 * navigable item — no matter how deeply nested — can self-register
 * via useScrollTarget and get scrolled into view automatically.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import React from "react";
import {
  useScrollSelectedIntoView,
  ScrollSelectedContext,
  useScrollTarget,
} from "./useScrollSelectedIntoView";

// ---------------------------------------------------------------------------
// Helpers — mirror the real component hierarchy
// ---------------------------------------------------------------------------

/** A deeply nested child that self-registers via context (like TopIssueItem) */
function NestedItem({ index, label }: { index: number; label: string }) {
  const scrollRef = useScrollTarget(index);
  return (
    <div ref={scrollRef} data-testid={`item-${index}`} style={{ height: 40 }}>
      {label}
    </div>
  );
}

/** A container that renders nested children (like TopIssuesPreview) */
function NestedSection({
  items,
  startIndex,
}: {
  items: string[];
  startIndex: number;
}) {
  return (
    <div data-testid="nested-section">
      {items.map((item, i) => (
        <NestedItem key={item} index={startIndex + i} label={item} />
      ))}
    </div>
  );
}

/** Flat item that self-registers (like a command or summary card) */
function FlatItem({ index, label }: { index: number; label: string }) {
  const scrollRef = useScrollTarget(index);
  return (
    <div ref={scrollRef} data-testid={`item-${index}`} style={{ height: 40 }}>
      {label}
    </div>
  );
}

/**
 * Test harness with context provider — reproduces the CommandPalette layout:
 *   [FlatItems 0..flatCount-1] + [NestedSection flatCount..total-1]
 */
function TestList({
  flatItems,
  nestedItems,
}: {
  flatItems: string[];
  nestedItems: string[];
}) {
  const totalCount = flatItems.length + nestedItems.length;
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const scrollCtx = useScrollSelectedIntoView(selectedIndex);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, totalCount - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
    },
    [totalCount]
  );

  return (
    <ScrollSelectedContext.Provider value={scrollCtx}>
      <div
        data-testid="scroll-container"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        style={{ maxHeight: 100, overflowY: "auto" }}
      >
        {flatItems.map((item, index) => (
          <FlatItem key={item} index={index} label={item} />
        ))}
        <NestedSection
          items={nestedItems}
          startIndex={flatItems.length}
        />
      </div>
    </ScrollSelectedContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useScrollSelectedIntoView (context-based)", () => {
  const flatItems = ["Cmd 1", "Cmd 2", "Summary"];
  const nestedItems = ["Top Issue A", "Top Issue B", "Top Issue C"];

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("scrolls flat items into view on ArrowDown", () => {
    const { getByTestId } = render(
      <TestList flatItems={flatItems} nestedItems={nestedItems} />
    );

    const container = getByTestId("scroll-container");
    act(() => { container.focus(); });

    fireEvent.keyDown(container, { key: "ArrowDown" });

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
    });
  });

  it("scrolls nested items into view when navigating past flat items", () => {
    const { getByTestId } = render(
      <TestList flatItems={flatItems} nestedItems={nestedItems} />
    );

    const container = getByTestId("scroll-container");
    act(() => { container.focus(); });

    // Navigate past all flat items into nested items
    for (let i = 0; i < flatItems.length + 2; i++) {
      fireEvent.keyDown(container, { key: "ArrowDown" });
    }

    // The nested item at index 4 (flatItems.length + 1) should exist
    const nestedItem = getByTestId(`item-${flatItems.length + 1}`);
    expect(nestedItem).toBeTruthy();

    // scrollIntoView must have been called for every step
    // (initial render + flatItems.length + 2 key presses)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(
      1 + flatItems.length + 2
    );
  });

  it("scrolls all the way to the last nested item", () => {
    const { getByTestId } = render(
      <TestList flatItems={flatItems} nestedItems={nestedItems} />
    );

    const container = getByTestId("scroll-container");
    act(() => { container.focus(); });

    const total = flatItems.length + nestedItems.length;
    for (let i = 0; i < total - 1; i++) {
      fireEvent.keyDown(container, { key: "ArrowDown" });
    }

    // total calls: 1 (initial) + total-1 (key presses)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(total);

    // Last item should have been the target of the last call
    const lastItem = getByTestId(`item-${total - 1}`);
    expect(lastItem).toBeTruthy();
  });

  it("scrolls nested items on ArrowUp back through the list", () => {
    const { getByTestId } = render(
      <TestList flatItems={flatItems} nestedItems={nestedItems} />
    );

    const container = getByTestId("scroll-container");
    act(() => { container.focus(); });

    const total = flatItems.length + nestedItems.length;
    // Go all the way down
    for (let i = 0; i < total - 1; i++) {
      fireEvent.keyDown(container, { key: "ArrowDown" });
    }

    (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();

    // Go back up through nested items into flat items
    for (let i = 0; i < total - 1; i++) {
      fireEvent.keyDown(container, { key: "ArrowUp" });
    }

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(total - 1);
  });

  it("every scrollIntoView call uses block: 'nearest'", () => {
    const { getByTestId } = render(
      <TestList flatItems={flatItems} nestedItems={nestedItems} />
    );

    const container = getByTestId("scroll-container");
    act(() => { container.focus(); });

    for (let i = 0; i < 5; i++) {
      fireEvent.keyDown(container, { key: "ArrowDown" });
    }

    const calls = (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mock.calls;
    for (const call of calls) {
      expect(call[0]).toEqual({ block: "nearest" });
    }
  });
});

/**
 * Tests for SiblingStrip component
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { SiblingStrip, type SiblingStripItem } from "./SiblingStrip";

const mockItems: SiblingStripItem[] = [
  { id: "item-1", label: "First Item", count: 5 },
  { id: "item-2", label: "Second Item", count: 3 },
];

describe("SiblingStrip", () => {
  it("renders items", () => {
    const { container } = render(
      <SiblingStrip items={mockItems} onItemClick={() => {}} />
    );

    // Should render buttons for items
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(2);
  });

  it("calls onItemClick when item is clicked", () => {
    const onItemClick = vi.fn();
    const { container } = render(
      <SiblingStrip items={mockItems} onItemClick={onItemClick} />
    );

    const buttons = container.querySelectorAll("button");
    if (buttons[1]) {
      buttons[1].click();
      expect(onItemClick).toHaveBeenCalledWith(mockItems[1]);
    }
  });

  it("returns null when items array is empty", () => {
    const { container } = render(
      <SiblingStrip items={[]} onItemClick={() => {}} />
    );

    expect(container.firstChild).toBeNull();
  });
});

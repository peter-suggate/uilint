/**
 * Tests for useTileNavigation hook
 * @vitest-environment jsdom
 *
 * Tests 2D keyboard navigation for tile grids with configurable columns.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTileNavigation } from "./useTileNavigation";
import type { TileItem } from "../../core/plugin-system/types";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock tile item
 */
function createMockTileItem(id: string, label: string = `Item ${id}`): TileItem {
  return {
    id,
    label,
    count: 1,
  };
}

/**
 * Create an array of mock tile items
 */
function createMockTileItems(count: number): TileItem[] {
  return Array.from({ length: count }, (_, i) =>
    createMockTileItem(`item-${i}`, `Item ${i}`)
  );
}

/**
 * Create a mock keyboard event
 */
function createKeyboardEvent(key: string): React.KeyboardEvent {
  return {
    key,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent;
}

// ============================================================================
// Tests
// ============================================================================

describe("useTileNavigation", () => {
  const mockOnSelect = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe("initialization", () => {
    it("initializes selectedIndex to 0", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      expect(result.current.selectedIndex).toBe(0);
    });

    it("provides setSelectedIndex function", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      expect(typeof result.current.setSelectedIndex).toBe("function");
    });

    it("provides handleKeyDown function", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      expect(typeof result.current.handleKeyDown).toBe("function");
    });
  });

  // ============================================================================
  // ArrowDown Navigation Tests
  // ============================================================================

  describe("ArrowDown navigation", () => {
    it("moves down by column count", () => {
      const items = createMockTileItems(9); // 3x3 grid
      const columns = 3;
      const { result } = renderHook(() =>
        useTileNavigation(items, columns, mockOnSelect)
      );

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });

      expect(result.current.selectedIndex).toBe(3); // 0 + 3
    });

    it("moves down multiple times correctly", () => {
      const items = createMockTileItems(9); // 3x3 grid
      const columns = 3;
      const { result } = renderHook(() =>
        useTileNavigation(items, columns, mockOnSelect)
      );

      // Start at index 0, move down twice
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });
      expect(result.current.selectedIndex).toBe(3);

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });
      expect(result.current.selectedIndex).toBe(6);
    });

    it("wraps to first row when going past last row", () => {
      const items = createMockTileItems(9); // 3x3 grid
      const columns = 3;
      const { result } = renderHook(() =>
        useTileNavigation(items, columns, mockOnSelect)
      );

      // Start at index 6 (last row, first column)
      act(() => {
        result.current.setSelectedIndex(6);
      });

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });

      // Should wrap to first row, same column (index 0)
      expect(result.current.selectedIndex).toBe(0);
    });

    it("prevents default on ArrowDown", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      const event = createKeyboardEvent("ArrowDown");
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // ArrowUp Navigation Tests
  // ============================================================================

  describe("ArrowUp navigation", () => {
    it("moves up by column count", () => {
      const items = createMockTileItems(9); // 3x3 grid
      const columns = 3;
      const { result } = renderHook(() =>
        useTileNavigation(items, columns, mockOnSelect)
      );

      // Start at index 6
      act(() => {
        result.current.setSelectedIndex(6);
      });

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowUp"));
      });

      expect(result.current.selectedIndex).toBe(3); // 6 - 3
    });

    it("wraps to last row when going before first row", () => {
      const items = createMockTileItems(9); // 3x3 grid
      const columns = 3;
      const { result } = renderHook(() =>
        useTileNavigation(items, columns, mockOnSelect)
      );

      // Start at index 0
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowUp"));
      });

      // Should wrap to last row, same column (index 6)
      expect(result.current.selectedIndex).toBe(6);
    });

    it("wraps to correct column in last row", () => {
      const items = createMockTileItems(9); // 3x3 grid
      const columns = 3;
      const { result } = renderHook(() =>
        useTileNavigation(items, columns, mockOnSelect)
      );

      // Start at index 1 (first row, second column)
      act(() => {
        result.current.setSelectedIndex(1);
      });

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowUp"));
      });

      // Should wrap to last row, same column (index 7)
      expect(result.current.selectedIndex).toBe(7);
    });

    it("clamps to last item when wrapping with incomplete last row", () => {
      const items = createMockTileItems(7); // Incomplete 3x3 grid
      const columns = 3;
      const { result } = renderHook(() =>
        useTileNavigation(items, columns, mockOnSelect)
      );

      // Start at index 2 (first row, third column)
      act(() => {
        result.current.setSelectedIndex(2);
      });

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowUp"));
      });

      // Last row only has index 6, so should clamp to 6
      expect(result.current.selectedIndex).toBe(6);
    });

    it("prevents default on ArrowUp", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      const event = createKeyboardEvent("ArrowUp");
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // ArrowLeft Navigation Tests
  // ============================================================================

  describe("ArrowLeft navigation", () => {
    it("moves left within row", () => {
      const items = createMockTileItems(9); // 3x3 grid
      const columns = 3;
      const { result } = renderHook(() =>
        useTileNavigation(items, columns, mockOnSelect)
      );

      // Start at index 1
      act(() => {
        result.current.setSelectedIndex(1);
      });

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowLeft"));
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    it("stops at row start (does not wrap)", () => {
      const items = createMockTileItems(9); // 3x3 grid
      const columns = 3;
      const { result } = renderHook(() =>
        useTileNavigation(items, columns, mockOnSelect)
      );

      // Start at row start (index 0)
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowLeft"));
      });

      // Should stay at 0
      expect(result.current.selectedIndex).toBe(0);
    });

    it("stops at row start for middle rows", () => {
      const items = createMockTileItems(9); // 3x3 grid
      const columns = 3;
      const { result } = renderHook(() =>
        useTileNavigation(items, columns, mockOnSelect)
      );

      // Start at index 3 (second row start)
      act(() => {
        result.current.setSelectedIndex(3);
      });

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowLeft"));
      });

      // Should stay at 3
      expect(result.current.selectedIndex).toBe(3);
    });

    it("prevents default on ArrowLeft", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      const event = createKeyboardEvent("ArrowLeft");
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // ArrowRight Navigation Tests
  // ============================================================================

  describe("ArrowRight navigation", () => {
    it("moves right within row", () => {
      const items = createMockTileItems(9); // 3x3 grid
      const columns = 3;
      const { result } = renderHook(() =>
        useTileNavigation(items, columns, mockOnSelect)
      );

      // Start at index 0
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowRight"));
      });

      expect(result.current.selectedIndex).toBe(1);
    });

    it("stops at row end (does not wrap)", () => {
      const items = createMockTileItems(9); // 3x3 grid
      const columns = 3;
      const { result } = renderHook(() =>
        useTileNavigation(items, columns, mockOnSelect)
      );

      // Start at index 2 (first row end)
      act(() => {
        result.current.setSelectedIndex(2);
      });

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowRight"));
      });

      // Should stay at 2
      expect(result.current.selectedIndex).toBe(2);
    });

    it("stops at row end for middle rows", () => {
      const items = createMockTileItems(9); // 3x3 grid
      const columns = 3;
      const { result } = renderHook(() =>
        useTileNavigation(items, columns, mockOnSelect)
      );

      // Start at index 5 (second row end)
      act(() => {
        result.current.setSelectedIndex(5);
      });

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowRight"));
      });

      // Should stay at 5
      expect(result.current.selectedIndex).toBe(5);
    });

    it("respects item count when row is incomplete", () => {
      const items = createMockTileItems(7); // Incomplete 3x3 grid
      const columns = 3;
      const { result } = renderHook(() =>
        useTileNavigation(items, columns, mockOnSelect)
      );

      // Start at index 6 (last row, only item)
      act(() => {
        result.current.setSelectedIndex(6);
      });

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowRight"));
      });

      // Should stay at 6 (can't go right, no more items)
      expect(result.current.selectedIndex).toBe(6);
    });

    it("prevents default on ArrowRight", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      const event = createKeyboardEvent("ArrowRight");
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Enter Key Tests
  // ============================================================================

  describe("Enter key", () => {
    it("calls onSelect with current item", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("Enter"));
      });

      expect(mockOnSelect).toHaveBeenCalledTimes(1);
      expect(mockOnSelect).toHaveBeenCalledWith(items[0]);
    });

    it("calls onSelect with correct item after navigation", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      // Navigate to index 4
      act(() => {
        result.current.setSelectedIndex(4);
      });

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("Enter"));
      });

      expect(mockOnSelect).toHaveBeenCalledWith(items[4]);
    });

    it("does not call onSelect when items array is empty", () => {
      const items: TileItem[] = [];
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("Enter"));
      });

      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it("prevents default on Enter", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      const event = createKeyboardEvent("Enter");
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Backspace Key Tests
  // ============================================================================

  describe("Backspace key", () => {
    it("calls onBack when provided", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect, mockOnBack)
      );

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("Backspace"));
      });

      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });

    it("does not call onBack when not provided", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect, undefined)
      );

      // Should not throw
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("Backspace"));
      });

      expect(mockOnBack).not.toHaveBeenCalled();
    });

    it("prevents default when onBack is provided", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect, mockOnBack)
      );

      const event = createKeyboardEvent("Backspace");
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("does not prevent default when onBack is not provided", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect, undefined)
      );

      const event = createKeyboardEvent("Backspace");
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Home Key Tests
  // ============================================================================

  describe("Home key", () => {
    it("jumps to first item", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      // Start somewhere in the middle
      act(() => {
        result.current.setSelectedIndex(5);
      });

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("Home"));
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    it("stays at 0 if already at first item", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("Home"));
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    it("prevents default on Home", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      const event = createKeyboardEvent("Home");
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // End Key Tests
  // ============================================================================

  describe("End key", () => {
    it("jumps to last item", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("End"));
      });

      expect(result.current.selectedIndex).toBe(8); // Last item
    });

    it("stays at last if already at last item", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      // Start at last item
      act(() => {
        result.current.setSelectedIndex(8);
      });

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("End"));
      });

      expect(result.current.selectedIndex).toBe(8);
    });

    it("works with incomplete grids", () => {
      const items = createMockTileItems(7);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("End"));
      });

      expect(result.current.selectedIndex).toBe(6); // Last item (index 6)
    });

    it("prevents default on End", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      const event = createKeyboardEvent("End");
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Items Change Tests
  // ============================================================================

  describe("items change", () => {
    it("resets selectedIndex when items change", () => {
      const initialItems = createMockTileItems(9);
      const { result, rerender } = renderHook(
        ({ items }) => useTileNavigation(items, 3, mockOnSelect),
        { initialProps: { items: initialItems } }
      );

      // Navigate to index 5
      act(() => {
        result.current.setSelectedIndex(5);
      });
      expect(result.current.selectedIndex).toBe(5);

      // Change items array
      const newItems = createMockTileItems(6);
      rerender({ items: newItems });

      expect(result.current.selectedIndex).toBe(0);
    });

    it("resets index when items are replaced with different reference", () => {
      const initialItems = createMockTileItems(9);
      const { result, rerender } = renderHook(
        ({ items }) => useTileNavigation(items, 3, mockOnSelect),
        { initialProps: { items: initialItems } }
      );

      act(() => {
        result.current.setSelectedIndex(4);
      });

      // New array with same content but different reference
      const newItems = [...initialItems];
      rerender({ items: newItems });

      expect(result.current.selectedIndex).toBe(0);
    });
  });

  // ============================================================================
  // Empty Items Tests
  // ============================================================================

  describe("empty items", () => {
    it("handles empty items array gracefully", () => {
      const items: TileItem[] = [];
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      // Should not throw on any key
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowUp"));
      });
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowLeft"));
      });
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowRight"));
      });
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("Home"));
      });
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("End"));
      });

      expect(result.current.selectedIndex).toBe(0);
    });
  });

  // ============================================================================
  // Unhandled Keys Tests
  // ============================================================================

  describe("unhandled keys", () => {
    it("does not prevent default for unhandled keys", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      const event = createKeyboardEvent("a");
      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("does not change selectedIndex for unhandled keys", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      act(() => {
        result.current.setSelectedIndex(4);
      });

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("x"));
      });

      expect(result.current.selectedIndex).toBe(4);
    });
  });

  // ============================================================================
  // Different Column Counts Tests
  // ============================================================================

  describe("different column counts", () => {
    it("works with 1 column (vertical list)", () => {
      const items = createMockTileItems(5);
      const columns = 1;
      const { result } = renderHook(() =>
        useTileNavigation(items, columns, mockOnSelect)
      );

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });
      expect(result.current.selectedIndex).toBe(1);

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });
      expect(result.current.selectedIndex).toBe(2);
    });

    it("works with 4 columns", () => {
      const items = createMockTileItems(12); // 3x4 grid
      const columns = 4;
      const { result } = renderHook(() =>
        useTileNavigation(items, columns, mockOnSelect)
      );

      // Move down should go to index 4
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });
      expect(result.current.selectedIndex).toBe(4);

      // Move right 3 times to end of row (starting from index 4)
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowRight"));
      });
      expect(result.current.selectedIndex).toBe(5);

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowRight"));
      });
      expect(result.current.selectedIndex).toBe(6);

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowRight"));
      });
      expect(result.current.selectedIndex).toBe(7);
    });

    it("works with column count greater than item count", () => {
      const items = createMockTileItems(2);
      const columns = 5;
      const { result } = renderHook(() =>
        useTileNavigation(items, columns, mockOnSelect)
      );

      // ArrowDown should wrap since there's only one row
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
      });
      expect(result.current.selectedIndex).toBe(0);

      // ArrowRight should work
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowRight"));
      });
      expect(result.current.selectedIndex).toBe(1);

      // ArrowRight at end should stay
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent("ArrowRight"));
      });
      expect(result.current.selectedIndex).toBe(1);
    });
  });

  // ============================================================================
  // setSelectedIndex Direct Usage Tests
  // ============================================================================

  describe("setSelectedIndex direct usage", () => {
    it("allows setting index directly", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      act(() => {
        result.current.setSelectedIndex(7);
      });

      expect(result.current.selectedIndex).toBe(7);
    });

    it("allows setting any valid index", () => {
      const items = createMockTileItems(9);
      const { result } = renderHook(() =>
        useTileNavigation(items, 3, mockOnSelect)
      );

      act(() => {
        result.current.setSelectedIndex(0);
      });
      expect(result.current.selectedIndex).toBe(0);

      act(() => {
        result.current.setSelectedIndex(8);
      });
      expect(result.current.selectedIndex).toBe(8);
    });
  });
});

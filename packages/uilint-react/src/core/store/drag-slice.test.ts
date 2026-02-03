/**
 * Unit tests for drag-slice.ts
 *
 * Tests the drag state slice including:
 * - Starting, updating, and ending drag operations
 * - Drag type checking
 * - Delta calculations
 * - Selectors
 */

import { describe, it, expect, vi } from "vitest";
import {
  createDragSlice,
  type DragSlice,
  type DragType,
  selectIsDragging,
  selectIsDraggingType,
  selectDragDelta,
  selectDraggedElementPosition,
  selectDraggedElementSize,
} from "./drag-slice";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a test instance of the drag slice with mock set/get functions.
 */
function createTestSlice() {
  const sliceCreator = createDragSlice;

  let currentState: DragSlice;

  const mockSet = vi.fn((partial: Partial<DragSlice> | ((state: DragSlice) => Partial<DragSlice>)) => {
    if (typeof partial === "function") {
      const updates = partial(currentState);
      currentState = { ...currentState, ...updates };
    } else {
      currentState = { ...currentState, ...partial };
    }
  });

  const mockGet = vi.fn(() => currentState);

  // @ts-expect-error - Using simplified mock functions
  currentState = sliceCreator(mockSet, mockGet);

  return {
    getState: () => currentState,
    set: mockSet,
    get: mockGet,
  };
}

// ============================================================================
// Initial State Tests
// ============================================================================

describe("Drag Slice - Initial State", () => {
  it("has activeDrag as null by default", () => {
    const { getState } = createTestSlice();
    expect(getState().activeDrag).toBeNull();
  });

  it("isDragging returns false when no drag is active", () => {
    const { getState } = createTestSlice();
    expect(getState().isDragging()).toBe(false);
  });

  it("getDragDelta returns null when no drag is active", () => {
    const { getState } = createTestSlice();
    expect(getState().getDragDelta()).toBeNull();
  });
});

// ============================================================================
// startDrag Tests
// ============================================================================

describe("Drag Slice - startDrag", () => {
  it("sets activeDrag with basic parameters", () => {
    const { getState } = createTestSlice();

    getState().startDrag(
      "inspector-floating",
      { x: 100, y: 200 },
      { x: 10, y: 20 }
    );

    expect(getState().activeDrag).toEqual({
      type: "inspector-floating",
      startPos: { x: 100, y: 200 },
      currentPos: { x: 100, y: 200 },
      offset: { x: 10, y: 20 },
      elementStartPos: undefined,
      elementStartSize: undefined,
    });
  });

  it("sets activeDrag with element start position", () => {
    const { getState } = createTestSlice();

    getState().startDrag(
      "inspector-floating",
      { x: 150, y: 250 },
      { x: 5, y: 5 },
      { x: 50, y: 100 }
    );

    expect(getState().activeDrag?.elementStartPos).toEqual({ x: 50, y: 100 });
  });

  it("sets activeDrag with element start size for resize", () => {
    const { getState } = createTestSlice();

    getState().startDrag(
      "inspector-resize",
      { x: 300, y: 400 },
      { x: 0, y: 0 },
      { x: 100, y: 80 },
      { width: 400, height: 500 }
    );

    expect(getState().activeDrag?.elementStartSize).toEqual({ width: 400, height: 500 });
  });

  it("initializes currentPos to startPos", () => {
    const { getState } = createTestSlice();

    getState().startDrag(
      "inspector-floating",
      { x: 123, y: 456 },
      { x: 0, y: 0 }
    );

    expect(getState().activeDrag?.currentPos).toEqual({ x: 123, y: 456 });
  });

  it("supports all drag types", () => {
    const dragTypes: DragType[] = [
      "inspector-floating",
      "inspector-resize",
      "docked-resize",
    ];

    dragTypes.forEach((type) => {
      const { getState } = createTestSlice();

      getState().startDrag(type, { x: 0, y: 0 }, { x: 0, y: 0 });

      expect(getState().activeDrag?.type).toBe(type);
    });
  });
});

// ============================================================================
// updateDrag Tests
// ============================================================================

describe("Drag Slice - updateDrag", () => {
  it("updates currentPos during drag", () => {
    const { getState } = createTestSlice();

    getState().startDrag("inspector-floating", { x: 100, y: 100 }, { x: 0, y: 0 });
    getState().updateDrag({ x: 200, y: 150 });

    expect(getState().activeDrag?.currentPos).toEqual({ x: 200, y: 150 });
  });

  it("preserves other activeDrag properties", () => {
    const { getState } = createTestSlice();

    getState().startDrag(
      "inspector-floating",
      { x: 100, y: 100 },
      { x: 10, y: 20 },
      { x: 50, y: 50 }
    );
    getState().updateDrag({ x: 300, y: 300 });

    const drag = getState().activeDrag;
    expect(drag?.type).toBe("inspector-floating");
    expect(drag?.startPos).toEqual({ x: 100, y: 100 });
    expect(drag?.offset).toEqual({ x: 10, y: 20 });
    expect(drag?.elementStartPos).toEqual({ x: 50, y: 50 });
  });

  it("does nothing if no drag is active", () => {
    const { getState } = createTestSlice();

    getState().updateDrag({ x: 500, y: 500 });

    expect(getState().activeDrag).toBeNull();
  });

  it("can be called multiple times during drag", () => {
    const { getState } = createTestSlice();

    getState().startDrag("inspector-floating", { x: 0, y: 0 }, { x: 0, y: 0 });

    getState().updateDrag({ x: 10, y: 10 });
    expect(getState().activeDrag?.currentPos).toEqual({ x: 10, y: 10 });

    getState().updateDrag({ x: 20, y: 25 });
    expect(getState().activeDrag?.currentPos).toEqual({ x: 20, y: 25 });

    getState().updateDrag({ x: 100, y: 200 });
    expect(getState().activeDrag?.currentPos).toEqual({ x: 100, y: 200 });
  });
});

// ============================================================================
// endDrag Tests
// ============================================================================

describe("Drag Slice - endDrag", () => {
  it("sets activeDrag to null", () => {
    const { getState } = createTestSlice();

    getState().startDrag("inspector-floating", { x: 100, y: 100 }, { x: 0, y: 0 });
    expect(getState().activeDrag).not.toBeNull();

    getState().endDrag();

    expect(getState().activeDrag).toBeNull();
  });

  it("does not throw if called when no drag is active", () => {
    const { getState } = createTestSlice();

    expect(() => getState().endDrag()).not.toThrow();
    expect(getState().activeDrag).toBeNull();
  });

  it("can start a new drag after ending previous", () => {
    const { getState } = createTestSlice();

    getState().startDrag("inspector-floating", { x: 100, y: 100 }, { x: 0, y: 0 });
    getState().endDrag();

    getState().startDrag("inspector-floating", { x: 200, y: 200 }, { x: 5, y: 5 });

    expect(getState().activeDrag?.type).toBe("inspector-floating");
  });
});

// ============================================================================
// isDragging Tests
// ============================================================================

describe("Drag Slice - isDragging", () => {
  it("returns true when any drag is active", () => {
    const { getState } = createTestSlice();

    getState().startDrag("inspector-floating", { x: 0, y: 0 }, { x: 0, y: 0 });

    expect(getState().isDragging()).toBe(true);
  });

  it("returns false when no drag is active", () => {
    const { getState } = createTestSlice();

    expect(getState().isDragging()).toBe(false);
  });

  it("returns true when checking for active drag type", () => {
    const { getState } = createTestSlice();

    getState().startDrag("inspector-resize", { x: 0, y: 0 }, { x: 0, y: 0 });

    expect(getState().isDragging("inspector-resize")).toBe(true);
  });

  it("returns false when checking for different drag type", () => {
    const { getState } = createTestSlice();

    getState().startDrag("inspector-floating", { x: 0, y: 0 }, { x: 0, y: 0 });

    expect(getState().isDragging("inspector-resize")).toBe(false);
    expect(getState().isDragging("docked-resize")).toBe(false);
  });

  it("returns false after drag ends", () => {
    const { getState } = createTestSlice();

    getState().startDrag("inspector-floating", { x: 0, y: 0 }, { x: 0, y: 0 });
    getState().endDrag();

    expect(getState().isDragging()).toBe(false);
  });
});

// ============================================================================
// getDragDelta Tests
// ============================================================================

describe("Drag Slice - getDragDelta", () => {
  it("returns delta between start and current position", () => {
    const { getState } = createTestSlice();

    getState().startDrag("inspector-floating", { x: 100, y: 100 }, { x: 0, y: 0 });
    getState().updateDrag({ x: 150, y: 180 });

    expect(getState().getDragDelta()).toEqual({ x: 50, y: 80 });
  });

  it("returns zero delta at drag start", () => {
    const { getState } = createTestSlice();

    getState().startDrag("inspector-floating", { x: 100, y: 100 }, { x: 0, y: 0 });

    expect(getState().getDragDelta()).toEqual({ x: 0, y: 0 });
  });

  it("handles negative delta (dragging left/up)", () => {
    const { getState } = createTestSlice();

    getState().startDrag("inspector-floating", { x: 200, y: 200 }, { x: 0, y: 0 });
    getState().updateDrag({ x: 100, y: 50 });

    expect(getState().getDragDelta()).toEqual({ x: -100, y: -150 });
  });

  it("returns null when no drag is active", () => {
    const { getState } = createTestSlice();

    expect(getState().getDragDelta()).toBeNull();
  });
});

// ============================================================================
// Selectors Tests
// ============================================================================

describe("Drag Slice - Selectors", () => {
  describe("selectIsDragging", () => {
    it("returns true when dragging", () => {
      const { getState } = createTestSlice();
      getState().startDrag("inspector-floating", { x: 0, y: 0 }, { x: 0, y: 0 });

      expect(selectIsDragging(getState())).toBe(true);
    });

    it("returns false when not dragging", () => {
      const { getState } = createTestSlice();

      expect(selectIsDragging(getState())).toBe(false);
    });
  });

  describe("selectIsDraggingType", () => {
    it("returns true for matching type", () => {
      const { getState } = createTestSlice();
      getState().startDrag("inspector-floating", { x: 0, y: 0 }, { x: 0, y: 0 });

      expect(selectIsDraggingType(getState(), "inspector-floating")).toBe(true);
    });

    it("returns false for non-matching type", () => {
      const { getState } = createTestSlice();
      getState().startDrag("inspector-floating", { x: 0, y: 0 }, { x: 0, y: 0 });

      expect(selectIsDraggingType(getState(), "inspector-resize")).toBe(false);
    });
  });

  describe("selectDragDelta", () => {
    it("returns correct delta", () => {
      const { getState } = createTestSlice();
      getState().startDrag("inspector-floating", { x: 50, y: 50 }, { x: 0, y: 0 });
      getState().updateDrag({ x: 100, y: 75 });

      expect(selectDragDelta(getState())).toEqual({ x: 50, y: 25 });
    });

    it("returns null when not dragging", () => {
      const { getState } = createTestSlice();

      expect(selectDragDelta(getState())).toBeNull();
    });
  });

  describe("selectDraggedElementPosition", () => {
    it("returns element position plus delta", () => {
      const { getState } = createTestSlice();
      getState().startDrag(
        "inspector-floating",
        { x: 100, y: 100 },
        { x: 0, y: 0 },
        { x: 200, y: 150 }
      );
      getState().updateDrag({ x: 130, y: 120 });

      expect(selectDraggedElementPosition(getState())).toEqual({ x: 230, y: 170 });
    });

    it("returns null if no elementStartPos", () => {
      const { getState } = createTestSlice();
      getState().startDrag("inspector-floating", { x: 0, y: 0 }, { x: 0, y: 0 });
      getState().updateDrag({ x: 50, y: 50 });

      expect(selectDraggedElementPosition(getState())).toBeNull();
    });

    it("returns null when not dragging", () => {
      const { getState } = createTestSlice();

      expect(selectDraggedElementPosition(getState())).toBeNull();
    });
  });

  describe("selectDraggedElementSize", () => {
    it("returns element size plus delta", () => {
      const { getState } = createTestSlice();
      getState().startDrag(
        "inspector-resize",
        { x: 400, y: 500 },
        { x: 0, y: 0 },
        undefined,
        { width: 300, height: 400 }
      );
      getState().updateDrag({ x: 450, y: 550 });

      expect(selectDraggedElementSize(getState())).toEqual({ width: 350, height: 450 });
    });

    it("handles negative delta (shrinking)", () => {
      const { getState } = createTestSlice();
      getState().startDrag(
        "inspector-resize",
        { x: 400, y: 500 },
        { x: 0, y: 0 },
        undefined,
        { width: 300, height: 400 }
      );
      getState().updateDrag({ x: 350, y: 450 });

      expect(selectDraggedElementSize(getState())).toEqual({ width: 250, height: 350 });
    });

    it("returns null if no elementStartSize", () => {
      const { getState } = createTestSlice();
      getState().startDrag("inspector-floating", { x: 0, y: 0 }, { x: 0, y: 0 });

      expect(selectDraggedElementSize(getState())).toBeNull();
    });

    it("returns null when not dragging", () => {
      const { getState } = createTestSlice();

      expect(selectDraggedElementSize(getState())).toBeNull();
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Drag Slice - Integration", () => {
  it("full drag lifecycle for floating icon", () => {
    const { getState } = createTestSlice();

    // Start drag
    getState().startDrag(
      "inspector-floating",
      { x: 100, y: 50 },
      { x: 10, y: 5 },
      { x: 200, y: 16 }
    );
    expect(getState().isDragging("inspector-floating")).toBe(true);
    expect(selectDraggedElementPosition(getState())).toEqual({ x: 200, y: 16 });

    // Move during drag
    getState().updateDrag({ x: 150, y: 100 });
    expect(selectDragDelta(getState())).toEqual({ x: 50, y: 50 });
    expect(selectDraggedElementPosition(getState())).toEqual({ x: 250, y: 66 });

    // End drag
    getState().endDrag();
    expect(getState().isDragging()).toBe(false);
    expect(selectDragDelta(getState())).toBeNull();
  });

  it("full resize lifecycle for inspector", () => {
    const { getState } = createTestSlice();

    // Start resize
    getState().startDrag(
      "inspector-resize",
      { x: 500, y: 600 },
      { x: 0, y: 0 },
      undefined,
      { width: 400, height: 500 }
    );
    expect(getState().isDragging("inspector-resize")).toBe(true);

    // Resize larger
    getState().updateDrag({ x: 550, y: 650 });
    expect(selectDraggedElementSize(getState())).toEqual({ width: 450, height: 550 });

    // End resize
    getState().endDrag();
    expect(getState().isDragging()).toBe(false);
  });

  it("switching drag types mid-operation replaces previous drag", () => {
    const { getState } = createTestSlice();

    // Start inspector floating drag
    getState().startDrag("inspector-floating", { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(getState().isDragging("inspector-floating")).toBe(true);

    // Start inspector resize drag (would normally end previous first, but testing edge case)
    getState().startDrag("inspector-resize", { x: 100, y: 100 }, { x: 5, y: 5 });

    // New drag should replace old
    expect(getState().isDragging("inspector-resize")).toBe(true);
    expect(getState().isDragging("inspector-floating")).toBe(false);
  });
});

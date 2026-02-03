/**
 * Drag State Slice
 *
 * Zustand slice for unified drag state management.
 * Handles drag operations for InspectorSidebar and resize handles.
 *
 * Components call startDrag on mouse/touch down, and the subscription system
 * handles move/end events globally, eliminating useEffect-based event listeners.
 */

import type { StateCreator } from "zustand";

// ============================================================================
// Types
// ============================================================================

/**
 * Position in pixel coordinates.
 */
export interface DragPosition {
  x: number;
  y: number;
}

/**
 * Types of draggable elements in the UI.
 */
export type DragType =
  | "inspector-floating"
  | "inspector-resize"
  | "docked-resize";

/**
 * Active drag operation state.
 */
export interface ActiveDrag {
  /** Type of element being dragged */
  type: DragType;
  /** Mouse/touch position at drag start */
  startPos: DragPosition;
  /** Current mouse/touch position */
  currentPos: DragPosition;
  /** Offset from element origin to cursor at start (for maintaining grab point) */
  offset: DragPosition;
  /** Initial element position at drag start (for calculating final position) */
  elementStartPos?: DragPosition;
  /** Initial element size at drag start (for resize operations) */
  elementStartSize?: { width: number; height: number };
}

// ============================================================================
// Slice Interface
// ============================================================================

/**
 * Drag state slice interface.
 */
export interface DragSlice {
  // ============ State ============
  /** Currently active drag operation, null if not dragging */
  activeDrag: ActiveDrag | null;

  // ============ Actions ============
  /**
   * Start a drag operation.
   *
   * @param type - Type of element being dragged
   * @param startPos - Mouse/touch position at start
   * @param offset - Offset from element origin to cursor
   * @param elementStartPos - Initial element position (optional)
   * @param elementStartSize - Initial element size for resize (optional)
   */
  startDrag: (
    type: DragType,
    startPos: DragPosition,
    offset: DragPosition,
    elementStartPos?: DragPosition,
    elementStartSize?: { width: number; height: number }
  ) => void;

  /**
   * Update the current position during drag.
   * Called by the global mouse/touch move subscription.
   *
   * @param currentPos - Current mouse/touch position
   */
  updateDrag: (currentPos: DragPosition) => void;

  /**
   * End the current drag operation.
   * Called by the global mouse/touch up subscription.
   */
  endDrag: () => void;

  /**
   * Check if currently dragging a specific type.
   *
   * @param type - Type to check
   * @returns true if dragging that type
   */
  isDragging: (type?: DragType) => boolean;

  /**
   * Get the delta from drag start to current position.
   *
   * @returns Delta position or null if not dragging
   */
  getDragDelta: () => DragPosition | null;
}

// ============================================================================
// Slice Creator
// ============================================================================

/**
 * Create the drag state slice.
 */
export const createDragSlice: StateCreator<DragSlice> = (set, get) => ({
  // ============ State ============
  activeDrag: null,

  // ============ Actions ============
  startDrag: (type, startPos, offset, elementStartPos, elementStartSize) => {
    set({
      activeDrag: {
        type,
        startPos,
        currentPos: startPos,
        offset,
        elementStartPos,
        elementStartSize,
      },
    });
  },

  updateDrag: (currentPos) => {
    const { activeDrag } = get();
    if (!activeDrag) return;

    set({
      activeDrag: {
        ...activeDrag,
        currentPos,
      },
    });
  },

  endDrag: () => {
    set({ activeDrag: null });
  },

  isDragging: (type) => {
    const { activeDrag } = get();
    if (!activeDrag) return false;
    if (type === undefined) return true;
    return activeDrag.type === type;
  },

  getDragDelta: () => {
    const { activeDrag } = get();
    if (!activeDrag) return null;

    return {
      x: activeDrag.currentPos.x - activeDrag.startPos.x,
      y: activeDrag.currentPos.y - activeDrag.startPos.y,
    };
  },
});

// ============================================================================
// Selectors
// ============================================================================

/**
 * Selector to check if any drag is active.
 */
export function selectIsDragging(state: DragSlice): boolean {
  return state.activeDrag !== null;
}

/**
 * Selector to check if dragging a specific type.
 */
export function selectIsDraggingType(state: DragSlice, type: DragType): boolean {
  return state.activeDrag?.type === type;
}

/**
 * Selector to get the current drag delta.
 */
export function selectDragDelta(state: DragSlice): DragPosition | null {
  const { activeDrag } = state;
  if (!activeDrag) return null;

  return {
    x: activeDrag.currentPos.x - activeDrag.startPos.x,
    y: activeDrag.currentPos.y - activeDrag.startPos.y,
  };
}

/**
 * Selector to get the calculated element position during drag.
 * Returns the element's start position plus the drag delta.
 */
export function selectDraggedElementPosition(state: DragSlice): DragPosition | null {
  const { activeDrag } = state;
  if (!activeDrag?.elementStartPos) return null;

  const delta = selectDragDelta(state);
  if (!delta) return null;

  return {
    x: activeDrag.elementStartPos.x + delta.x,
    y: activeDrag.elementStartPos.y + delta.y,
  };
}

/**
 * Selector to get the calculated element size during resize drag.
 * Returns the element's start size plus the drag delta.
 */
export function selectDraggedElementSize(
  state: DragSlice
): { width: number; height: number } | null {
  const { activeDrag } = state;
  if (!activeDrag?.elementStartSize) return null;

  const delta = selectDragDelta(state);
  if (!delta) return null;

  return {
    width: activeDrag.elementStartSize.width + delta.x,
    height: activeDrag.elementStartSize.height + delta.y,
  };
}

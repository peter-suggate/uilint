/**
 * Additional coverage tests for subscriptions.ts
 *
 * Covers functionality NOT already tested in subscriptions.test.ts:
 * - initializeDragHandlers (mousemove, mouseup, touchmove, touchend, touchcancel)
 * - SSR safety (typeof window === 'undefined')
 * - initializeSubscriptions option: enableDragHandlers
 * - Keyboard shortcut edge cases (Cmd+K toggles when already open)
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { create, type StoreApi } from "zustand";
import {
  initializeDragHandlers,
  initializeKeyboardShortcuts,
  initializeMobileDetection,
  initializeSubscriptions,
  computeMobileState,
} from "./subscriptions";
import type { MobileState } from "./core-slice";
import type { ComposedStore } from "./composed-store";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock store with drag-related state for testing drag handlers.
 */
function createMockStoreWithDrag() {
  type MockState = {
    commandPalette: { open: boolean };
    inspector: { open: boolean; docked: boolean };
    mobile: MobileState;
    altKeyHeld: boolean;
    activeDrag: { x: number; y: number } | null;
    openCommandPalette: () => void;
    closeCommandPalette: () => void;
    setAltKeyHeld: (held: boolean) => void;
    setMobileState: (state: MobileState) => void;
    toggleInspectorDocked: () => void;
    updateDrag: (pos: { x: number; y: number }) => void;
    endDrag: () => void;
  };

  return create<MockState>()((set) => ({
    commandPalette: { open: false },
    inspector: { open: false, docked: true },
    mobile: {
      isMobile: false,
      isTablet: false,
      isTouchDevice: false,
      isSmallScreen: false,
    },
    altKeyHeld: false,
    activeDrag: null,
    openCommandPalette: () =>
      set((state) => ({ commandPalette: { ...state.commandPalette, open: true } })),
    closeCommandPalette: () =>
      set((state) => ({ commandPalette: { ...state.commandPalette, open: false } })),
    setAltKeyHeld: (held) => set({ altKeyHeld: held }),
    setMobileState: (mobileState) => set({ mobile: mobileState }),
    toggleInspectorDocked: () =>
      set((state) => ({
        inspector: { ...state.inspector, docked: !state.inspector.docked },
      })),
    updateDrag: (pos) => set({ activeDrag: pos }),
    endDrag: () => set({ activeDrag: null }),
  }));
}

// ============================================================================
// initializeDragHandlers Tests
// ============================================================================

describe("initializeDragHandlers", () => {
  let store: ReturnType<typeof createMockStoreWithDrag>;
  let cleanup: () => void;

  beforeEach(() => {
    store = createMockStoreWithDrag();
    cleanup = initializeDragHandlers(store as unknown as StoreApi<ComposedStore>);
  });

  afterEach(() => {
    cleanup();
  });

  describe("mousemove", () => {
    it("updates drag position when activeDrag is set", () => {
      // Start a drag
      store.setState({ activeDrag: { x: 0, y: 0 } });

      window.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 150, clientY: 250 })
      );

      expect(store.getState().activeDrag).toEqual({ x: 150, y: 250 });
    });

    it("does nothing when no activeDrag", () => {
      expect(store.getState().activeDrag).toBeNull();

      window.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 100, clientY: 200 })
      );

      expect(store.getState().activeDrag).toBeNull();
    });
  });

  describe("mouseup", () => {
    it("ends drag when activeDrag is set", () => {
      store.setState({ activeDrag: { x: 50, y: 50 } });

      window.dispatchEvent(new MouseEvent("mouseup"));

      expect(store.getState().activeDrag).toBeNull();
    });

    it("does nothing when no activeDrag", () => {
      window.dispatchEvent(new MouseEvent("mouseup"));

      expect(store.getState().activeDrag).toBeNull();
    });
  });

  describe("touchmove", () => {
    it("updates drag position from touch event", () => {
      store.setState({ activeDrag: { x: 0, y: 0 } });

      const touchEvent = new TouchEvent("touchmove", {
        touches: [{ clientX: 200, clientY: 300 } as Touch],
      });
      window.dispatchEvent(touchEvent);

      expect(store.getState().activeDrag).toEqual({ x: 200, y: 300 });
    });

    it("does nothing when no activeDrag", () => {
      const touchEvent = new TouchEvent("touchmove", {
        touches: [{ clientX: 200, clientY: 300 } as Touch],
      });
      window.dispatchEvent(touchEvent);

      expect(store.getState().activeDrag).toBeNull();
    });
  });

  describe("touchend", () => {
    it("ends drag on touchend", () => {
      store.setState({ activeDrag: { x: 10, y: 20 } });

      window.dispatchEvent(new TouchEvent("touchend"));

      expect(store.getState().activeDrag).toBeNull();
    });

    it("does nothing on touchend when no activeDrag", () => {
      window.dispatchEvent(new TouchEvent("touchend"));

      expect(store.getState().activeDrag).toBeNull();
    });
  });

  describe("touchcancel", () => {
    it("ends drag on touchcancel", () => {
      store.setState({ activeDrag: { x: 10, y: 20 } });

      window.dispatchEvent(new TouchEvent("touchcancel"));

      expect(store.getState().activeDrag).toBeNull();
    });
  });

  describe("cleanup", () => {
    it("removes all event listeners on cleanup", () => {
      store.setState({ activeDrag: { x: 0, y: 0 } });
      cleanup();

      // After cleanup, mousemove should not update drag
      window.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 999, clientY: 999 })
      );

      // activeDrag should remain at the value before cleanup, unaffected
      expect(store.getState().activeDrag).toEqual({ x: 0, y: 0 });
    });

    it("removes touchend listener on cleanup", () => {
      store.setState({ activeDrag: { x: 5, y: 5 } });
      cleanup();

      window.dispatchEvent(new TouchEvent("touchend"));

      // Should not have been ended because listeners are removed
      expect(store.getState().activeDrag).toEqual({ x: 5, y: 5 });
    });
  });
});

// ============================================================================
// SSR Safety Tests
// ============================================================================

describe("SSR safety (typeof window === 'undefined')", () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    // Restore window
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  it("initializeKeyboardShortcuts returns no-op cleanup in SSR", () => {
    // Simulate SSR by making window undefined
    // @ts-expect-error -- simulating SSR environment
    delete globalThis.window;

    const store = createMockStoreWithDrag();
    const cleanupFn = initializeKeyboardShortcuts(
      store as unknown as StoreApi<ComposedStore>
    );

    expect(typeof cleanupFn).toBe("function");
    // Calling cleanup should not throw
    cleanupFn();
  });

  it("initializeDragHandlers returns no-op cleanup in SSR", () => {
    // @ts-expect-error -- simulating SSR environment
    delete globalThis.window;

    const store = createMockStoreWithDrag();
    const cleanupFn = initializeDragHandlers(
      store as unknown as StoreApi<ComposedStore>
    );

    expect(typeof cleanupFn).toBe("function");
    cleanupFn();
  });

  it("initializeMobileDetection returns no-op cleanup in SSR", () => {
    // @ts-expect-error -- simulating SSR environment
    delete globalThis.window;

    const store = createMockStoreWithDrag();
    const cleanupFn = initializeMobileDetection(
      store as unknown as StoreApi<ComposedStore>
    );

    expect(typeof cleanupFn).toBe("function");
    cleanupFn();
  });

  it("computeMobileState returns all-false defaults in SSR", () => {
    // @ts-expect-error -- simulating SSR environment
    delete globalThis.window;

    const state = computeMobileState();

    expect(state).toEqual({
      isMobile: false,
      isTablet: false,
      isTouchDevice: false,
      isSmallScreen: false,
    });
  });
});

// ============================================================================
// initializeSubscriptions - drag handler option
// ============================================================================

describe("initializeSubscriptions - enableDragHandlers option", () => {
  let store: ReturnType<typeof createMockStoreWithDrag>;

  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1920,
    });
    store = createMockStoreWithDrag();
  });

  it("enables drag handlers by default", () => {
    const cleanup = initializeSubscriptions(
      store as unknown as StoreApi<ComposedStore>
    );

    // Set an active drag and verify mousemove updates it
    store.setState({ activeDrag: { x: 0, y: 0 } });
    window.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 42, clientY: 84 })
    );

    expect(store.getState().activeDrag).toEqual({ x: 42, y: 84 });

    cleanup();
  });

  it("can disable drag handlers via option", () => {
    const cleanup = initializeSubscriptions(
      store as unknown as StoreApi<ComposedStore>,
      { enableDragHandlers: false }
    );

    store.setState({ activeDrag: { x: 0, y: 0 } });
    window.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 42, clientY: 84 })
    );

    // Drag position should NOT update because handlers are disabled
    expect(store.getState().activeDrag).toEqual({ x: 0, y: 0 });

    cleanup();
  });
});

// ============================================================================
// Keyboard shortcut edge cases
// ============================================================================

describe("initializeKeyboardShortcuts - additional edge cases", () => {
  let store: ReturnType<typeof createMockStoreWithDrag>;
  let cleanup: () => void;

  beforeEach(() => {
    store = createMockStoreWithDrag();
    cleanup = initializeKeyboardShortcuts(
      store as unknown as StoreApi<ComposedStore>
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("Cmd+K toggles palette open then closed in sequence", () => {
    // First press opens
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
    );
    expect(store.getState().commandPalette.open).toBe(true);

    // Second press closes
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
    );
    expect(store.getState().commandPalette.open).toBe(false);
  });

  it("Escape does not affect palette when it is already closed", () => {
    expect(store.getState().commandPalette.open).toBe(false);

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );

    expect(store.getState().commandPalette.open).toBe(false);
  });

  it("plain 'k' without modifier does not toggle palette", () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", bubbles: true })
    );

    expect(store.getState().commandPalette.open).toBe(false);
  });

  it("Alt keydown sets altKeyHeld and keyup clears it", () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Alt", bubbles: true })
    );
    expect(store.getState().altKeyHeld).toBe(true);

    window.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Alt", bubbles: true })
    );
    expect(store.getState().altKeyHeld).toBe(false);
  });
});

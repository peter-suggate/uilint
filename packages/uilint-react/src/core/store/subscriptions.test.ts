/**
 * Unit tests for subscriptions.ts
 *
 * Tests the store subscription system including:
 * - Mobile state computation
 * - Keyboard shortcut handling
 * - Mobile detection subscription
 * - Inspector auto-undock behavior
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { create, type StoreApi } from "zustand";
import {
  computeMobileState,
  initializeKeyboardShortcuts,
  initializeMobileDetection,
  initializeInspectorAutoUndock,
  initializeSubscriptions,
} from "./subscriptions";
import { BREAKPOINTS, type MobileState } from "./core-slice";
import type { ComposedStore } from "./composed-store";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a minimal mock store for testing subscriptions.
 */
function createMockStore() {
  type MockState = {
    commandPalette: { open: boolean };
    inspector: { open: boolean; docked: boolean };
    mobile: MobileState;
    altKeyHeld: boolean;
    openCommandPalette: () => void;
    closeCommandPalette: () => void;
    setAltKeyHeld: (held: boolean) => void;
    setMobileState: (state: MobileState) => void;
    toggleInspectorDocked: () => void;
  };

  return create<MockState>()((set, _get) => ({
    commandPalette: { open: false },
    inspector: { open: false, docked: true },
    mobile: {
      isMobile: false,
      isTablet: false,
      isTouchDevice: false,
      isSmallScreen: false,
    },
    altKeyHeld: false,
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
  }));
}

/**
 * Helper to dispatch keyboard events.
 */
function dispatchKeyEvent(
  type: "keydown" | "keyup",
  key: string,
  options: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean } = {}
) {
  const event = new KeyboardEvent(type, {
    key,
    metaKey: options.metaKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    shiftKey: options.shiftKey ?? false,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
  return event;
}

/**
 * Mock window.innerWidth for responsive tests.
 */
function mockWindowWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
}

/**
 * Mock touch detection.
 */
function mockTouchDevice(hasTouch: boolean) {
  if (hasTouch) {
    Object.defineProperty(window, "ontouchstart", {
      writable: true,
      configurable: true,
      value: () => {},
    });
  } else {
    // @ts-expect-error - deleting for test purposes
    delete window.ontouchstart;
  }

  Object.defineProperty(navigator, "maxTouchPoints", {
    writable: true,
    configurable: true,
    value: hasTouch ? 5 : 0,
  });
}

// ============================================================================
// computeMobileState Tests
// ============================================================================

describe("computeMobileState", () => {
  beforeEach(() => {
    // Reset to desktop defaults
    mockWindowWidth(1920);
    mockTouchDevice(false);
  });

  it("returns desktop state for large viewport", () => {
    mockWindowWidth(1920);
    mockTouchDevice(false);

    const state = computeMobileState();

    expect(state.isMobile).toBe(false);
    expect(state.isTablet).toBe(false);
    expect(state.isSmallScreen).toBe(false);
  });

  it("returns mobile state for narrow viewport", () => {
    mockWindowWidth(375); // iPhone width

    const state = computeMobileState();

    expect(state.isMobile).toBe(true);
    expect(state.isTablet).toBe(false);
    expect(state.isSmallScreen).toBe(true);
  });

  it("returns tablet state for medium viewport", () => {
    mockWindowWidth(800);

    const state = computeMobileState();

    expect(state.isMobile).toBe(false);
    expect(state.isTablet).toBe(true);
    expect(state.isSmallScreen).toBe(false);
  });

  it("returns small screen state at breakpoint boundary", () => {
    mockWindowWidth(BREAKPOINTS.sm - 1);

    const state = computeMobileState();

    expect(state.isSmallScreen).toBe(true);
  });

  it("returns not small screen at sm breakpoint", () => {
    mockWindowWidth(BREAKPOINTS.sm);

    const state = computeMobileState();

    expect(state.isSmallScreen).toBe(false);
  });

  it("returns mobile at md breakpoint boundary", () => {
    mockWindowWidth(BREAKPOINTS.md - 1);

    const state = computeMobileState();

    expect(state.isMobile).toBe(true);
  });

  it("returns tablet at md breakpoint", () => {
    mockWindowWidth(BREAKPOINTS.md);

    const state = computeMobileState();

    expect(state.isMobile).toBe(false);
    expect(state.isTablet).toBe(true);
  });

  it("returns not tablet at lg breakpoint", () => {
    mockWindowWidth(BREAKPOINTS.lg);

    const state = computeMobileState();

    expect(state.isTablet).toBe(false);
  });
});

// ============================================================================
// initializeKeyboardShortcuts Tests
// ============================================================================

describe("initializeKeyboardShortcuts", () => {
  let store: ReturnType<typeof createMockStore>;
  let cleanup: () => void;

  beforeEach(() => {
    store = createMockStore();
    // Cast to satisfy the generic store type
    cleanup = initializeKeyboardShortcuts(store as unknown as StoreApi<ComposedStore>);
  });

  afterEach(() => {
    cleanup();
  });

  describe("Cmd/Ctrl+K toggle", () => {
    it("opens command palette with Cmd+K", () => {
      expect(store.getState().commandPalette.open).toBe(false);

      dispatchKeyEvent("keydown", "k", { metaKey: true });

      expect(store.getState().commandPalette.open).toBe(true);
    });

    it("opens command palette with Ctrl+K", () => {
      expect(store.getState().commandPalette.open).toBe(false);

      dispatchKeyEvent("keydown", "k", { ctrlKey: true });

      expect(store.getState().commandPalette.open).toBe(true);
    });

    it("closes command palette with Cmd+K when open", () => {
      store.getState().openCommandPalette();
      expect(store.getState().commandPalette.open).toBe(true);

      dispatchKeyEvent("keydown", "k", { metaKey: true });

      expect(store.getState().commandPalette.open).toBe(false);
    });

    it("does not trigger without modifier key", () => {
      dispatchKeyEvent("keydown", "k");

      expect(store.getState().commandPalette.open).toBe(false);
    });
  });

  describe("Escape to close", () => {
    it("closes command palette with Escape when open", () => {
      store.getState().openCommandPalette();
      expect(store.getState().commandPalette.open).toBe(true);

      dispatchKeyEvent("keydown", "Escape");

      expect(store.getState().commandPalette.open).toBe(false);
    });

    it("does nothing when command palette is closed", () => {
      expect(store.getState().commandPalette.open).toBe(false);

      dispatchKeyEvent("keydown", "Escape");

      expect(store.getState().commandPalette.open).toBe(false);
    });
  });

  describe("Alt key for heatmap details", () => {
    it("sets altKeyHeld to true on Alt keydown", () => {
      expect(store.getState().altKeyHeld).toBe(false);

      dispatchKeyEvent("keydown", "Alt");

      expect(store.getState().altKeyHeld).toBe(true);
    });

    it("sets altKeyHeld to false on Alt keyup", () => {
      store.getState().setAltKeyHeld(true);
      expect(store.getState().altKeyHeld).toBe(true);

      dispatchKeyEvent("keyup", "Alt");

      expect(store.getState().altKeyHeld).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("removes event listeners on cleanup", () => {
      cleanup();

      // After cleanup, events should not affect the store
      const openBefore = store.getState().commandPalette.open;
      dispatchKeyEvent("keydown", "k", { metaKey: true });

      expect(store.getState().commandPalette.open).toBe(openBefore);
    });
  });
});

// ============================================================================
// initializeMobileDetection Tests
// ============================================================================

describe("initializeMobileDetection", () => {
  let store: ReturnType<typeof createMockStore>;
  let cleanup: () => void;

  beforeEach(() => {
    mockWindowWidth(1920);
    mockTouchDevice(false);
    store = createMockStore();
    cleanup = initializeMobileDetection(store as unknown as StoreApi<ComposedStore>);
  });

  afterEach(() => {
    cleanup();
  });

  it("sets initial mobile state on initialization", () => {
    const state = store.getState().mobile;

    expect(state.isMobile).toBe(false);
    expect(state.isTablet).toBe(false);
    expect(state.isSmallScreen).toBe(false);
  });

  it("updates mobile state on resize event", () => {
    mockWindowWidth(375);
    window.dispatchEvent(new Event("resize"));

    const state = store.getState().mobile;

    expect(state.isMobile).toBe(true);
    expect(state.isSmallScreen).toBe(true);
  });

  it("updates mobile state on orientation change", () => {
    mockWindowWidth(500);
    window.dispatchEvent(new Event("orientationchange"));

    const state = store.getState().mobile;

    expect(state.isMobile).toBe(true);
  });

  it("removes event listeners on cleanup", () => {
    cleanup();

    // Change width and trigger resize - should not update store
    mockWindowWidth(375);
    window.dispatchEvent(new Event("resize"));

    // State should still be desktop (initial state when cleanup was called)
    expect(store.getState().mobile.isMobile).toBe(false);
  });
});

// ============================================================================
// initializeInspectorAutoUndock Tests
// ============================================================================

describe("initializeInspectorAutoUndock", () => {
  let store: ReturnType<typeof createMockStore>;
  let cleanup: () => void;

  beforeEach(() => {
    store = createMockStore();
    cleanup = initializeInspectorAutoUndock(store as unknown as StoreApi<ComposedStore>);
  });

  afterEach(() => {
    cleanup();
  });

  it("undocks inspector when transitioning to mobile while open and docked", () => {
    // Set up: inspector is open and docked
    store.setState({
      inspector: { open: true, docked: true },
      mobile: { isMobile: false, isTablet: false, isTouchDevice: false, isSmallScreen: false },
    });

    // Transition to mobile
    store.setState({
      mobile: { isMobile: true, isTablet: false, isTouchDevice: false, isSmallScreen: true },
    });

    expect(store.getState().inspector.docked).toBe(false);
  });

  it("does not undock when inspector is closed", () => {
    // Set up: inspector is closed and docked
    store.setState({
      inspector: { open: false, docked: true },
      mobile: { isMobile: false, isTablet: false, isTouchDevice: false, isSmallScreen: false },
    });

    // Transition to mobile
    store.setState({
      mobile: { isMobile: true, isTablet: false, isTouchDevice: false, isSmallScreen: true },
    });

    expect(store.getState().inspector.docked).toBe(true);
  });

  it("does not undock when already floating", () => {
    // Set up: inspector is open but floating
    store.setState({
      inspector: { open: true, docked: false },
      mobile: { isMobile: false, isTablet: false, isTouchDevice: false, isSmallScreen: false },
    });

    // Transition to mobile
    store.setState({
      mobile: { isMobile: true, isTablet: false, isTouchDevice: false, isSmallScreen: true },
    });

    // Should still be floating (no change)
    expect(store.getState().inspector.docked).toBe(false);
  });

  it("does not undock when already mobile", () => {
    // Need a fresh store that starts in mobile state
    const mobileStore = createMockStore();
    mobileStore.setState({
      inspector: { open: true, docked: true },
      mobile: { isMobile: true, isTablet: false, isTouchDevice: false, isSmallScreen: true },
    });

    // Initialize subscription AFTER setting mobile state
    // so previousIsMobile starts as true
    const mobileCleanup = initializeInspectorAutoUndock(
      mobileStore as unknown as StoreApi<ComposedStore>
    );

    // Update to still mobile (no transition)
    mobileStore.setState({
      mobile: { isMobile: true, isTablet: false, isTouchDevice: true, isSmallScreen: true },
    });

    // Should remain docked (no transition occurred)
    expect(mobileStore.getState().inspector.docked).toBe(true);

    mobileCleanup();
  });

  it("stops listening after cleanup", () => {
    // Set up: inspector is open and docked
    store.setState({
      inspector: { open: true, docked: true },
      mobile: { isMobile: false, isTablet: false, isTouchDevice: false, isSmallScreen: false },
    });

    cleanup();

    // Transition to mobile after cleanup
    store.setState({
      mobile: { isMobile: true, isTablet: false, isTouchDevice: false, isSmallScreen: true },
    });

    // Should still be docked (subscription was cleaned up)
    expect(store.getState().inspector.docked).toBe(true);
  });
});

// ============================================================================
// initializeSubscriptions Tests
// ============================================================================

describe("initializeSubscriptions", () => {
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    mockWindowWidth(1920);
    mockTouchDevice(false);
    store = createMockStore();
  });

  it("initializes all subscriptions by default", () => {
    const cleanup = initializeSubscriptions(store as unknown as StoreApi<ComposedStore>);

    // Test keyboard shortcuts work
    dispatchKeyEvent("keydown", "k", { metaKey: true });
    expect(store.getState().commandPalette.open).toBe(true);

    // Test mobile detection works (initial state set)
    expect(store.getState().mobile.isMobile).toBe(false);

    cleanup();
  });

  it("can disable keyboard shortcuts", () => {
    const cleanup = initializeSubscriptions(
      store as unknown as StoreApi<ComposedStore>,
      { enableKeyboardShortcuts: false }
    );

    dispatchKeyEvent("keydown", "k", { metaKey: true });
    expect(store.getState().commandPalette.open).toBe(false);

    cleanup();
  });

  it("can disable mobile detection", () => {
    const cleanup = initializeSubscriptions(
      store as unknown as StoreApi<ComposedStore>,
      { enableMobileDetection: false }
    );

    // Mobile state should remain at defaults (not initialized)
    mockWindowWidth(375);
    window.dispatchEvent(new Event("resize"));

    expect(store.getState().mobile.isMobile).toBe(false);

    cleanup();
  });

  it("cleanup removes all subscriptions", () => {
    const cleanup = initializeSubscriptions(store as unknown as StoreApi<ComposedStore>);
    cleanup();

    // Keyboard shortcuts should not work
    dispatchKeyEvent("keydown", "k", { metaKey: true });
    expect(store.getState().commandPalette.open).toBe(false);

    // Resize should not update state
    mockWindowWidth(375);
    window.dispatchEvent(new Event("resize"));
    expect(store.getState().mobile.isMobile).toBe(false);
  });
});

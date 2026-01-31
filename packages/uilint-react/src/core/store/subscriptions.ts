/**
 * Store Subscriptions
 *
 * Centralized subscription layer that runs outside React.
 * Handles global event listeners and updates the store directly.
 *
 * This eliminates the need for useEffect-based event listeners in components,
 * providing a more efficient and predictable way to handle:
 * - Keyboard shortcuts
 * - Viewport resize / mobile detection
 * - Orientation changes
 */

import type { StoreApi } from "zustand";
import type { ComposedStore } from "./composed-store";
import { BREAKPOINTS, type MobileState } from "./core-slice";
import { selectChildCategoryIds } from "./category-slice";
import { pluginRegistry } from "../plugin-system/registry";
import { getPluginServices } from "./composed-store";

// ============================================================================
// Types
// ============================================================================

/**
 * Cleanup function returned by subscription initializers.
 */
export type CleanupFn = () => void;

/**
 * Options for initializing subscriptions.
 */
export interface SubscriptionOptions {
  /** Whether to enable keyboard shortcuts (default: true) */
  enableKeyboardShortcuts?: boolean;
  /** Whether to enable mobile detection (default: true) */
  enableMobileDetection?: boolean;
  /** Whether to enable category auto-loading (default: true) */
  enableCategoryAutoLoad?: boolean;
  /** Whether to enable global drag handlers (default: true) */
  enableDragHandlers?: boolean;
}

// ============================================================================
// Mobile Detection Helpers
// ============================================================================

/**
 * Safely call matchMedia (not available in some environments like SSR/tests).
 */
function safeMatchMedia(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia(query);
}

/**
 * Compute the current mobile state based on window dimensions and touch capability.
 */
export function computeMobileState(): MobileState {
  if (typeof window === "undefined") {
    return {
      isMobile: false,
      isTablet: false,
      isTouchDevice: false,
      isSmallScreen: false,
    };
  }

  const width = window.innerWidth;
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const mq = safeMatchMedia("(pointer: coarse)");
  const prefersTouch = mq?.matches ?? false;

  return {
    isMobile: width < BREAKPOINTS.md,
    isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
    isTouchDevice: hasTouch && prefersTouch,
    isSmallScreen: width < BREAKPOINTS.sm,
  };
}

// ============================================================================
// Keyboard Shortcuts Subscription
// ============================================================================

/**
 * Initialize keyboard shortcut listeners.
 *
 * Handles:
 * - Cmd/Ctrl+K: Toggle command palette
 * - Cmd/Ctrl+Shift+C: Vision capture full page
 * - Cmd/Ctrl+Shift+R: Vision capture region
 * - Escape: Close command palette
 * - Alt: Enable heatmap hover details
 *
 * @param store - The Zustand store API
 * @returns Cleanup function to remove event listeners
 */
export function initializeKeyboardShortcuts(
  store: StoreApi<ComposedStore>
): CleanupFn {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    const state = store.getState();

    // Cmd+K or Ctrl+K toggles palette
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      if (state.commandPalette.open) {
        state.closeCommandPalette();
      } else {
        state.openCommandPalette();
      }
      return;
    }

    // Cmd+Shift+C or Ctrl+Shift+C: Vision capture full page
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "C") {
      e.preventDefault();
      const services = getPluginServices();
      if (!services) return;
      const groups = pluginRegistry.getAllToolbarActionGroups();
      for (const group of groups) {
        const action = group.actions.find((a) => a.id === "vision:capture-full-page");
        if (action) {
          action.onClick(services);
          return;
        }
      }
      return;
    }

    // Cmd+Shift+R or Ctrl+Shift+R: Vision capture region
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "R") {
      e.preventDefault();
      const services = getPluginServices();
      if (!services) return;
      const groups = pluginRegistry.getAllToolbarActionGroups();
      for (const group of groups) {
        const action = group.actions.find((a) => a.id === "vision:capture-region");
        if (action) {
          action.onClick(services);
          return;
        }
      }
      return;
    }

    // Escape closes palette
    if (e.key === "Escape" && state.commandPalette.open) {
      e.preventDefault();
      state.closeCommandPalette();
      return;
    }

    // Alt key for heatmap details
    if (e.key === "Alt") {
      state.setAltKeyHeld(true);
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === "Alt") {
      store.getState().setAltKeyHeld(false);
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
  };
}

// ============================================================================
// Mobile Detection Subscription
// ============================================================================

/**
 * Initialize mobile/viewport detection listeners.
 *
 * Updates the store's mobile state on:
 * - Window resize
 * - Orientation change
 * - Pointer media query change (coarse/fine)
 *
 * @param store - The Zustand store API
 * @returns Cleanup function to remove event listeners
 */
export function initializeMobileDetection(
  store: StoreApi<ComposedStore>
): CleanupFn {
  if (typeof window === "undefined") {
    return () => {};
  }

  const updateMobileState = () => {
    const mobileState = computeMobileState();
    store.getState().setMobileState(mobileState);
  };

  // Set initial state
  updateMobileState();

  // Use AbortController for clean event listener management
  const controller = new AbortController();
  const { signal } = controller;

  window.addEventListener("resize", updateMobileState, { signal });
  window.addEventListener("orientationchange", updateMobileState, { signal });

  // Also listen for pointer media query changes
  const mq = safeMatchMedia("(pointer: coarse)");
  if (mq) {
    mq.addEventListener("change", updateMobileState, { signal });
  }

  return () => {
    controller.abort();
  };
}

// ============================================================================
// Inspector Auto-Undock Subscription
// ============================================================================

/**
 * Initialize inspector auto-undock behavior.
 *
 * Automatically undocks the inspector when switching to mobile viewport
 * while the inspector is open and docked.
 *
 * @param store - The Zustand store API
 * @returns Cleanup function to unsubscribe
 */
export function initializeInspectorAutoUndock(
  store: StoreApi<ComposedStore>
): CleanupFn {
  // Subscribe to state changes with selector
  let previousIsMobile = store.getState().mobile.isMobile;

  const unsubscribe = store.subscribe((state) => {
    const { isMobile } = state.mobile;
    const { docked, open } = state.inspector;

    // Only act when transitioning TO mobile (not when already mobile)
    if (isMobile && !previousIsMobile && docked && open) {
      state.toggleInspectorDocked();
    }

    previousIsMobile = isMobile;
  });

  return unsubscribe;
}

// ============================================================================
// Drag Event Subscription
// ============================================================================

/**
 * Initialize global drag event handlers.
 *
 * Listens for mouse/touch move and end events globally and updates
 * the drag slice accordingly. This eliminates the need for useEffect-based
 * event listeners in individual draggable components.
 *
 * @param store - The Zustand store API
 * @returns Cleanup function to remove event listeners
 */
export function initializeDragHandlers(
  store: StoreApi<ComposedStore>
): CleanupFn {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleMouseMove = (e: MouseEvent) => {
    const state = store.getState();
    if (!state.activeDrag) return;

    state.updateDrag({ x: e.clientX, y: e.clientY });
  };

  const handleTouchMove = (e: TouchEvent) => {
    const state = store.getState();
    if (!state.activeDrag) return;

    const touch = e.touches[0];
    if (touch) {
      state.updateDrag({ x: touch.clientX, y: touch.clientY });
    }
  };

  const handleMouseUp = () => {
    const state = store.getState();
    if (state.activeDrag) {
      state.endDrag();
    }
  };

  const handleTouchEnd = () => {
    const state = store.getState();
    if (state.activeDrag) {
      state.endDrag();
    }
  };

  // Use capture phase to ensure we get events even if other handlers stop propagation
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
  window.addEventListener("touchmove", handleTouchMove, { passive: true });
  window.addEventListener("touchend", handleTouchEnd);
  window.addEventListener("touchcancel", handleTouchEnd);

  return () => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    window.removeEventListener("touchmove", handleTouchMove);
    window.removeEventListener("touchend", handleTouchEnd);
    window.removeEventListener("touchcancel", handleTouchEnd);
  };
}

// ============================================================================
// Category Loading Subscription
// ============================================================================

/**
 * Initialize category auto-loading behavior.
 *
 * Automatically loads category items when a category is selected in the
 * command palette sidebar. Also loads child categories for parent categories.
 *
 * @param store - The Zustand store API
 * @returns Cleanup function to unsubscribe
 */
export function initializeCategoryAutoLoad(
  store: StoreApi<ComposedStore>
): CleanupFn {
  let previousCategoryId: string | null = null;

  const unsubscribe = store.subscribe((state) => {
    const { selectedCategoryId } = state.commandPalette;

    // Only act when category selection changes
    if (selectedCategoryId !== previousCategoryId) {
      previousCategoryId = selectedCategoryId;

      if (selectedCategoryId) {
        // Load the selected category
        state.loadCategoryItems(selectedCategoryId);

        // Also load child categories if this is a parent
        const childIds = selectChildCategoryIds(state, selectedCategoryId);
        for (const childId of childIds) {
          state.loadCategoryItems(childId);
        }
      }
    }
  });

  return unsubscribe;
}

// ============================================================================
// Main Initialization
// ============================================================================

/**
 * Initialize all store subscriptions.
 *
 * This should be called once when the store is created.
 * Returns a cleanup function that removes all event listeners.
 *
 * @param store - The Zustand store API
 * @param options - Options for which subscriptions to enable
 * @returns Cleanup function to tear down all subscriptions
 *
 * @example
 * ```typescript
 * const store = createComposedStore();
 * const cleanup = initializeSubscriptions(store);
 *
 * // Later, when shutting down:
 * cleanup();
 * ```
 */
export function initializeSubscriptions(
  store: StoreApi<ComposedStore>,
  options: SubscriptionOptions = {}
): CleanupFn {
  const {
    enableKeyboardShortcuts = true,
    enableMobileDetection = true,
    enableCategoryAutoLoad = true,
    enableDragHandlers = true,
  } = options;

  const cleanupFns: CleanupFn[] = [];

  if (enableKeyboardShortcuts) {
    cleanupFns.push(initializeKeyboardShortcuts(store));
  }

  if (enableMobileDetection) {
    cleanupFns.push(initializeMobileDetection(store));
    cleanupFns.push(initializeInspectorAutoUndock(store));
  }

  if (enableCategoryAutoLoad) {
    cleanupFns.push(initializeCategoryAutoLoad(store));
  }

  if (enableDragHandlers) {
    cleanupFns.push(initializeDragHandlers(store));
  }

  // Return combined cleanup function
  return () => {
    cleanupFns.forEach((cleanup) => cleanup());
  };
}

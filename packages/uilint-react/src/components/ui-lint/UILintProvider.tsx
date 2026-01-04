"use client";

/**
 * UILint Provider - Context, state management, and keyboard shortcuts
 *
 * Provides Alt+Click element inspection functionality.
 * When Alt is held and hovering, shows element info tooltip.
 * When Alt+Click, opens the InspectionPanel sidebar.
 *
 * State management is handled by Zustand store. This component provides:
 * - React Context for backwards compatibility with useUILintContext()
 * - DOM event handlers for Alt key, mouse tracking, scroll wheel navigation
 * - UI component mounting
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type {
  UILintContextValue,
  UILintProviderProps,
  LocatorTarget,
  ComponentInfo,
} from "./types";
import {
  getFiberFromElement,
  getDebugSource,
  getComponentStack,
  getSourceFromDataLoc,
  isNodeModulesPath,
} from "./fiber-utils";
import {
  useUILintStore,
  useEffectiveLocatorTarget,
  type UILintStore,
} from "./store";

// Create context
const UILintContext = createContext<UILintContextValue | null>(null);

/**
 * Hook to access UILint context
 * For backwards compatibility - delegates to Zustand store
 */
export function useUILintContext(): UILintContextValue {
  const context = useContext(UILintContext);
  if (!context) {
    throw new Error("useUILintContext must be used within a UILintProvider");
  }
  return context;
}

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * UILint Provider Component
 */
export function UILintProvider({
  children,
  enabled = true,
}: UILintProviderProps) {
  const [isMounted, setIsMounted] = useState(false);

  // Get state from Zustand store
  const settings = useUILintStore((s: UILintStore) => s.settings);
  const updateSettings = useUILintStore((s: UILintStore) => s.updateSettings);
  const altKeyHeld = useUILintStore((s: UILintStore) => s.altKeyHeld);
  const setAltKeyHeld = useUILintStore((s: UILintStore) => s.setAltKeyHeld);
  const setLocatorTarget = useUILintStore(
    (s: UILintStore) => s.setLocatorTarget
  );
  const locatorStackIndex = useUILintStore(
    (s: UILintStore) => s.locatorStackIndex
  );
  const setLocatorStackIndex = useUILintStore(
    (s: UILintStore) => s.setLocatorStackIndex
  );
  const locatorGoUp = useUILintStore((s: UILintStore) => s.locatorGoUp);
  const locatorGoDown = useUILintStore((s: UILintStore) => s.locatorGoDown);
  const inspectedElement = useUILintStore(
    (s: UILintStore) => s.inspectedElement
  );
  const setInspectedElement = useUILintStore(
    (s: UILintStore) => s.setInspectedElement
  );
  const autoScanState = useUILintStore((s: UILintStore) => s.autoScanState);
  const elementIssuesCache = useUILintStore(
    (s: UILintStore) => s.elementIssuesCache
  );
  const startAutoScan = useUILintStore((s: UILintStore) => s.startAutoScan);
  const pauseAutoScan = useUILintStore((s: UILintStore) => s.pauseAutoScan);
  const resumeAutoScan = useUILintStore((s: UILintStore) => s.resumeAutoScan);
  const stopAutoScan = useUILintStore((s: UILintStore) => s.stopAutoScan);

  // Get computed locator target with stack index
  const effectiveLocatorTarget = useEffectiveLocatorTarget();

  /**
   * Get element info from a DOM element for locator mode
   */
  const getLocatorTargetFromElement = useCallback(
    (element: Element): LocatorTarget | null => {
      // Skip UILint's own UI elements
      if (element.closest("[data-ui-lint]")) return null;

      // Prefer React Fiber debug info for source paths (keeps absolute paths for editor links).
      // Fall back to data-loc if fiber info isn't available.
      let source: ReturnType<typeof getDebugSource> | null = null;
      let componentStack: ComponentInfo[] = [];

      const fiber = getFiberFromElement(element);
      if (fiber) {
        source = getDebugSource(fiber);
        if (!source && fiber._debugOwner) {
          source = getDebugSource(fiber._debugOwner);
        }
        componentStack = getComponentStack(fiber);
      }

      // Fallback to data-loc (injected by build transform) if we couldn't get fiber source
      if (!source) {
        source = getSourceFromDataLoc(element);
      }

      // Skip if no source found
      if (!source && componentStack.length === 0) return null;

      // Skip node_modules if enabled
      if (
        settings.hideNodeModules &&
        source &&
        isNodeModulesPath(source.fileName)
      ) {
        const appSource = componentStack.find(
          (c) => c.source && !isNodeModulesPath(c.source.fileName)
        );
        if (appSource?.source) {
          source = appSource.source;
        } else if (componentStack.length === 0) {
          return null;
        }
      }

      return {
        element,
        source,
        componentStack,
        rect: element.getBoundingClientRect(),
        stackIndex: 0,
      };
    },
    [settings.hideNodeModules]
  );

  /**
   * Handle mouse move for locator mode
   * When inspecting, allow hover without Alt key
   */
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!altKeyHeld && !inspectedElement) return;

      const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
      if (!elementAtPoint) {
        setLocatorTarget(null);
        return;
      }

      // Find the nearest element with source info
      let current: Element | null = elementAtPoint;
      while (current) {
        const target = getLocatorTargetFromElement(current);
        if (target) {
          setLocatorTarget(target);
          return;
        }
        current = current.parentElement;
      }

      setLocatorTarget(null);
    },
    [
      altKeyHeld,
      inspectedElement,
      getLocatorTargetFromElement,
      setLocatorTarget,
    ]
  );

  /**
   * Handle click in locator mode - open sidebar instead of editor
   */
  const handleLocatorClick = useCallback(
    (e: MouseEvent) => {
      // Allow click-to-select when Alt is held OR when inspector is already open.
      // (When inspector is open we want plain click to select without requiring Alt.)
      if ((!altKeyHeld && !inspectedElement) || !effectiveLocatorTarget) return;

      // Ignore clicks on UILint UI
      const targetEl = e.target as Element | null;
      if (targetEl?.closest?.("[data-ui-lint]")) return;

      e.preventDefault();
      e.stopPropagation();

      // Determine which source to use based on stack index
      let source = effectiveLocatorTarget.source;
      if (
        locatorStackIndex > 0 &&
        effectiveLocatorTarget.componentStack.length > 0
      ) {
        const stackItem =
          effectiveLocatorTarget.componentStack[locatorStackIndex - 1];
        if (stackItem?.source) {
          source = stackItem.source;
        }
      }

      // Open the inspection panel sidebar
      setInspectedElement({
        element: effectiveLocatorTarget.element,
        source,
        componentStack: effectiveLocatorTarget.componentStack,
        rect: effectiveLocatorTarget.rect,
      });

      // Reset locator state (but do not reset altKeyHeld - user may still be holding Alt)
      setLocatorTarget(null);
      setLocatorStackIndex(0);
    },
    [
      altKeyHeld,
      effectiveLocatorTarget,
      inspectedElement,
      locatorStackIndex,
      setInspectedElement,
      setLocatorTarget,
      setLocatorStackIndex,
    ]
  );

  /**
   * Alt-key event handling
   */
  useEffect(() => {
    if (!isBrowser() || !enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        setAltKeyHeld(true);
        setLocatorStackIndex(0);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        setAltKeyHeld(false);
        setLocatorTarget(null);
        setLocatorStackIndex(0);
      }
    };

    // Handle window blur (alt-tab away)
    const handleBlur = () => {
      setAltKeyHeld(false);
      setLocatorTarget(null);
      setLocatorStackIndex(0);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [enabled, setAltKeyHeld, setLocatorTarget, setLocatorStackIndex]);

  /**
   * Mouse tracking for locator mode
   * Active when Alt is held OR when inspecting an element
   */
  useEffect(() => {
    if (!isBrowser() || !enabled) return;
    if (!altKeyHeld && !inspectedElement) return;

    window.addEventListener("mousemove", handleMouseMove);
    // Add click handler when Alt is held OR inspector is open (click-to-select)
    window.addEventListener("click", handleLocatorClick, true);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleLocatorClick, true);
    };
  }, [
    enabled,
    altKeyHeld,
    inspectedElement,
    handleMouseMove,
    handleLocatorClick,
  ]);

  /**
   * Scroll wheel for parent navigation in locator mode
   */
  useEffect(() => {
    if (!isBrowser() || !enabled || !altKeyHeld) return;

    const handleWheel = (e: WheelEvent) => {
      if (!effectiveLocatorTarget) return;
      e.preventDefault();
      if (e.deltaY > 0) {
        locatorGoUp();
      } else {
        locatorGoDown();
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [enabled, altKeyHeld, effectiveLocatorTarget, locatorGoUp, locatorGoDown]);

  /**
   * Escape key to close sidebar
   */
  useEffect(() => {
    if (!isBrowser() || !enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && inspectedElement) {
        setInspectedElement(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, inspectedElement, setInspectedElement]);

  /**
   * Set mounted state after hydration
   */
  useEffect(() => {
    setIsMounted(true);
  }, []);

  /**
   * Wrap startAutoScan to pass hideNodeModules from settings
   */
  const wrappedStartAutoScan = useCallback(() => {
    startAutoScan(settings.hideNodeModules);
  }, [startAutoScan, settings.hideNodeModules]);

  /**
   * Context value - provides backwards compatibility with useUILintContext
   */
  const contextValue = useMemo<UILintContextValue>(
    () => ({
      settings,
      updateSettings,
      altKeyHeld,
      locatorTarget: effectiveLocatorTarget,
      locatorGoUp,
      locatorGoDown,
      inspectedElement,
      setInspectedElement,
      autoScanState,
      elementIssuesCache,
      startAutoScan: wrappedStartAutoScan,
      pauseAutoScan,
      resumeAutoScan,
      stopAutoScan,
    }),
    [
      settings,
      updateSettings,
      altKeyHeld,
      effectiveLocatorTarget,
      locatorGoUp,
      locatorGoDown,
      inspectedElement,
      setInspectedElement,
      autoScanState,
      elementIssuesCache,
      wrappedStartAutoScan,
      pauseAutoScan,
      resumeAutoScan,
      stopAutoScan,
    ]
  );

  // Don't render UI until mounted (prevents hydration mismatch)
  const shouldRenderUI = enabled && isMounted;

  return (
    <UILintContext.Provider value={contextValue}>
      {children}
      {shouldRenderUI && <UILintUI />}
    </UILintContext.Provider>
  );
}

/**
 * UI components rendered when UILint is active
 */
function UILintUI() {
  const { altKeyHeld, inspectedElement, autoScanState } = useUILintContext();

  // Dynamically import components to avoid circular dependencies
  const [components, setComponents] = useState<{
    Toolbar: React.ComponentType;
    Panel: React.ComponentType;
    LocatorOverlay: React.ComponentType;
    InspectedHighlight: React.ComponentType;
    ElementBadges: React.ComponentType;
  } | null>(null);

  useEffect(() => {
    // Import components
    Promise.all([
      import("./UILintToolbar"),
      import("./InspectionPanel"),
      import("./LocatorOverlay"),
      import("./ElementBadges"),
    ]).then(([toolbar, panel, locator, badges]) => {
      setComponents({
        Toolbar: toolbar.UILintToolbar,
        Panel: panel.InspectionPanel,
        LocatorOverlay: locator.LocatorOverlay,
        InspectedHighlight: locator.InspectedElementHighlight,
        ElementBadges: badges.ElementBadges,
      });
    });
  }, []);

  if (!components) return null;

  const { Toolbar, Panel, LocatorOverlay, InspectedHighlight, ElementBadges } =
    components;

  const showBadges = autoScanState.status !== "idle";

  return (
    <>
      <Toolbar />
      {(altKeyHeld || inspectedElement) && <LocatorOverlay />}
      {showBadges && <ElementBadges />}
      {inspectedElement && (
        <>
          <InspectedHighlight />
          <Panel />
        </>
      )}
    </>
  );
}

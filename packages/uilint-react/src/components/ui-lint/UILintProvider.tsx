"use client";

/**
 * UILint Provider - Context, state management, and keyboard shortcuts
 *
 * Provides Alt+Click element inspection functionality.
 * When Alt is held and hovering, shows element info tooltip.
 * When Alt+Click, opens the InspectionPanel sidebar.
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
  UILintSettings,
  LocatorTarget,
  SourceLocation,
  ComponentInfo,
  InspectedElement,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";
import {
  getFiberFromElement,
  getDebugSource,
  getComponentStack,
  getSourceFromDataLoc,
  isNodeModulesPath,
} from "./fiber-utils";

// Create context
const UILintContext = createContext<UILintContextValue | null>(null);

/**
 * Hook to access UILint context
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
  // State
  const [settings, setSettings] = useState<UILintSettings>(DEFAULT_SETTINGS);
  const [isMounted, setIsMounted] = useState(false);

  // Locator mode state (Alt-key hover)
  const [altKeyHeld, setAltKeyHeld] = useState(false);
  const [locatorTarget, setLocatorTarget] = useState<LocatorTarget | null>(
    null
  );
  const [locatorStackIndex, setLocatorStackIndex] = useState(0);

  // Inspected element state (opens sidebar)
  const [inspectedElement, setInspectedElement] =
    useState<InspectedElement | null>(null);

  /**
   * Update settings partially
   */
  const updateSettings = useCallback((partial: Partial<UILintSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  /**
   * Navigate up the component stack in locator mode
   */
  const locatorGoUp = useCallback(() => {
    if (!locatorTarget) return;
    const maxIndex = locatorTarget.componentStack.length;
    setLocatorStackIndex((prev) => Math.min(prev + 1, maxIndex));
  }, [locatorTarget]);

  /**
   * Navigate down the component stack in locator mode
   */
  const locatorGoDown = useCallback(() => {
    setLocatorStackIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  /**
   * Get element info from a DOM element for locator mode
   */
  const getLocatorTargetFromElement = useCallback(
    (element: Element): LocatorTarget | null => {
      // Skip UILint's own UI elements
      if (element.closest("[data-ui-lint]")) return null;

      // Try data-loc first
      let source = getSourceFromDataLoc(element);
      let componentStack: ComponentInfo[] = [];

      // Fallback to React Fiber
      if (!source) {
        const fiber = getFiberFromElement(element);
        if (fiber) {
          source = getDebugSource(fiber);
          if (!source && fiber._debugOwner) {
            source = getDebugSource(fiber._debugOwner);
          }
          componentStack = getComponentStack(fiber);
        }
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
   */
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!altKeyHeld) return;

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
    [altKeyHeld, getLocatorTargetFromElement]
  );

  /**
   * Handle click in locator mode - open sidebar instead of editor
   */
  const handleLocatorClick = useCallback(
    (e: MouseEvent) => {
      if (!altKeyHeld || !locatorTarget) return;

      e.preventDefault();
      e.stopPropagation();

      // Determine which source to use based on stack index
      let source = locatorTarget.source;
      if (locatorStackIndex > 0 && locatorTarget.componentStack.length > 0) {
        const stackItem = locatorTarget.componentStack[locatorStackIndex - 1];
        if (stackItem?.source) {
          source = stackItem.source;
        }
      }

      // Open the inspection panel sidebar
      setInspectedElement({
        element: locatorTarget.element,
        source,
        componentStack: locatorTarget.componentStack,
        rect: locatorTarget.rect,
      });

      // Reset locator state
      setAltKeyHeld(false);
      setLocatorTarget(null);
      setLocatorStackIndex(0);
    },
    [altKeyHeld, locatorTarget, locatorStackIndex]
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
  }, [enabled]);

  /**
   * Mouse tracking for locator mode
   */
  useEffect(() => {
    if (!isBrowser() || !enabled || !altKeyHeld) return;

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("click", handleLocatorClick, true);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleLocatorClick, true);
    };
  }, [enabled, altKeyHeld, handleMouseMove, handleLocatorClick]);

  /**
   * Scroll wheel for parent navigation in locator mode
   */
  useEffect(() => {
    if (!isBrowser() || !enabled || !altKeyHeld) return;

    const handleWheel = (e: WheelEvent) => {
      if (!locatorTarget) return;
      e.preventDefault();
      if (e.deltaY > 0) {
        locatorGoUp();
      } else {
        locatorGoDown();
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [enabled, altKeyHeld, locatorTarget, locatorGoUp, locatorGoDown]);

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
  }, [enabled, inspectedElement]);

  /**
   * Set mounted state after hydration
   */
  useEffect(() => {
    setIsMounted(true);
  }, []);

  /**
   * Compute the effective locator target with current stack index
   */
  const effectiveLocatorTarget = useMemo<LocatorTarget | null>(() => {
    if (!locatorTarget) return null;
    return {
      ...locatorTarget,
      stackIndex: locatorStackIndex,
    };
  }, [locatorTarget, locatorStackIndex]);

  /**
   * Context value
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
    }),
    [
      settings,
      updateSettings,
      altKeyHeld,
      effectiveLocatorTarget,
      locatorGoUp,
      locatorGoDown,
      inspectedElement,
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
  const { altKeyHeld, inspectedElement } = useUILintContext();

  // Dynamically import components to avoid circular dependencies
  const [components, setComponents] = useState<{
    Toolbar: React.ComponentType;
    Panel: React.ComponentType;
    LocatorOverlay: React.ComponentType;
    InspectedHighlight: React.ComponentType;
  } | null>(null);

  useEffect(() => {
    // Import components
    Promise.all([
      import("./UILintToolbar"),
      import("./InspectionPanel"),
      import("./LocatorOverlay"),
    ]).then(([toolbar, panel, locator]) => {
      setComponents({
        Toolbar: toolbar.UILintToolbar,
        Panel: panel.InspectionPanel,
        LocatorOverlay: locator.LocatorOverlay,
        InspectedHighlight: locator.InspectedElementHighlight,
      });
    });
  }, []);

  if (!components) return null;

  const { Toolbar, Panel, LocatorOverlay, InspectedHighlight } = components;

  return (
    <>
      <Toolbar />
      {altKeyHeld && <LocatorOverlay />}
      {inspectedElement && (
        <>
          <InspectedHighlight />
          <Panel />
        </>
      )}
    </>
  );
}

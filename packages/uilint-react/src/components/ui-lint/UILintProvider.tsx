"use client";

/**
 * UILint Provider - Context, state management, and keyboard shortcuts
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
  UILintMode,
  UILintSettings,
  ScannedElement,
  LocatorTarget,
  SourceLocation,
  ComponentInfo,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { useElementScan } from "./use-element-scan";
import {
  getFiberFromElement,
  getDebugSource,
  getComponentStack,
  getSourceFromDataLoc,
  isNodeModulesPath,
  buildEditorUrl,
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
  defaultMode = "off",
}: UILintProviderProps) {
  // State
  const [mode, setMode] = useState<UILintMode>(defaultMode);
  const [settings, setSettings] = useState<UILintSettings>(DEFAULT_SETTINGS);
  const [selectedElement, setSelectedElement] = useState<ScannedElement | null>(
    null
  );
  const [hoveredElement, setHoveredElement] = useState<ScannedElement | null>(
    null
  );
  const [isMounted, setIsMounted] = useState(false);

  // Locator mode state (Alt-key hover)
  const [altKeyHeld, setAltKeyHeld] = useState(false);
  const [locatorTarget, setLocatorTarget] = useState<LocatorTarget | null>(
    null
  );
  const [locatorStackIndex, setLocatorStackIndex] = useState(0);

  // Determine if scanning should be active
  const isActive = enabled && mode !== "off";

  // Element scanning hook
  const { elements, sourceFiles, isScanning, rescan } = useElementScan({
    enabled: isActive,
    settings,
  });

  /**
   * Update settings partially
   */
  const updateSettings = useCallback((partial: Partial<UILintSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  /**
   * Toggle through modes
   */
  const toggleMode = useCallback(() => {
    setMode((prev) => {
      if (prev === "off") return "sources";
      if (prev === "sources") return "inspect";
      return "off";
    });
  }, []);

  /**
   * Close/deselect handler
   */
  const handleEscape = useCallback(() => {
    if (selectedElement) {
      setSelectedElement(null);
    } else if (mode !== "off") {
      setMode("off");
    }
  }, [selectedElement, mode]);

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
   * Handle click in locator mode - open in editor
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

      if (source) {
        const url = buildEditorUrl(source, "cursor");
        window.open(url, "_blank");
      }
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
   * Keyboard shortcuts
   */
  useEffect(() => {
    if (!isBrowser() || !enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Shift + D - Toggle mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "d") {
        e.preventDefault();
        toggleMode();
        return;
      }

      // Escape - Close/deselect
      if (e.key === "Escape") {
        handleEscape();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, toggleMode, handleEscape]);

  /**
   * Set mounted state after hydration
   */
  useEffect(() => {
    setIsMounted(true);
  }, []);

  /**
   * Clear selection when mode changes
   */
  useEffect(() => {
    setSelectedElement(null);
    setHoveredElement(null);
  }, [mode]);

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
      mode,
      setMode,
      scannedElements: elements,
      sourceFiles,
      selectedElement,
      setSelectedElement,
      hoveredElement,
      setHoveredElement,
      settings,
      updateSettings,
      rescan,
      isScanning,
      altKeyHeld,
      locatorTarget: effectiveLocatorTarget,
      locatorGoUp,
      locatorGoDown,
    }),
    [
      mode,
      elements,
      sourceFiles,
      selectedElement,
      hoveredElement,
      settings,
      updateSettings,
      rescan,
      isScanning,
      altKeyHeld,
      effectiveLocatorTarget,
      locatorGoUp,
      locatorGoDown,
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
 * This is a placeholder - actual components will be imported
 */
function UILintUI() {
  const { mode, altKeyHeld } = useUILintContext();

  // Dynamically import components to avoid circular dependencies
  const [components, setComponents] = useState<{
    Toolbar: React.ComponentType;
    Overlays: React.ComponentType;
    Panel: React.ComponentType;
    LocatorOverlay: React.ComponentType;
  } | null>(null);

  useEffect(() => {
    // Import components
    Promise.all([
      import("./UILintToolbar"),
      import("./SourceOverlays"),
      import("./InspectionPanel"),
      import("./LocatorOverlay"),
    ]).then(([toolbar, overlays, panel, locator]) => {
      setComponents({
        Toolbar: toolbar.UILintToolbar,
        Overlays: overlays.SourceOverlays,
        Panel: panel.InspectionPanel,
        LocatorOverlay: locator.LocatorOverlay,
      });
    });
  }, []);

  if (!components) return null;

  const { Toolbar, Overlays, Panel, LocatorOverlay } = components;

  return (
    <>
      <Toolbar />
      {mode === "sources" && <Overlays />}
      {mode === "inspect" && (
        <>
          <Overlays />
          <Panel />
        </>
      )}
      {altKeyHeld && <LocatorOverlay />}
    </>
  );
}

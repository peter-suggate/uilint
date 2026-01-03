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
  useRef,
} from "react";
import type {
  UILintContextValue,
  UILintProviderProps,
  UILintSettings,
  LocatorTarget,
  ComponentInfo,
  InspectedElement,
  AutoScanState,
  ElementIssue,
  ScannedElement,
} from "./types";
import { DEFAULT_SETTINGS, DEFAULT_AUTO_SCAN_STATE } from "./types";
import {
  getFiberFromElement,
  getDebugSource,
  getComponentStack,
  getSourceFromDataLoc,
  isNodeModulesPath,
  scanDOMForSources,
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

  // Auto-scan state
  const [autoScanState, setAutoScanState] = useState<AutoScanState>(
    DEFAULT_AUTO_SCAN_STATE
  );
  const [elementIssuesCache, setElementIssuesCache] = useState<
    Map<string, ElementIssue>
  >(new Map());

  // Refs for scan control
  const scanPausedRef = useRef(false);
  const scanAbortRef = useRef(false);

  /**
   * Update settings partially
   */
  const updateSettings = useCallback((partial: Partial<UILintSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  /**
   * Scan a single element for issues
   */
  const scanElementForIssues = useCallback(
    async (element: ScannedElement): Promise<ElementIssue> => {
      if (!element.source) {
        return {
          elementId: element.id,
          issues: [],
          status: "complete",
        };
      }

      try {
        // Fetch source code
        const sourceResponse = await fetch(
          `/api/.uilint/source?path=${encodeURIComponent(
            element.source.fileName
          )}`
        );

        if (!sourceResponse.ok) {
          return {
            elementId: element.id,
            issues: [],
            status: "error",
          };
        }

        const sourceData = await sourceResponse.json();

        // Analyze with LLM
        const analyzeResponse = await fetch("/api/.uilint/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceCode: sourceData.content,
            filePath: sourceData.relativePath || element.source.fileName,
            componentName: element.componentStack[0]?.name || element.tagName,
            componentLine: element.source.lineNumber,
          }),
        });

        if (!analyzeResponse.ok) {
          return {
            elementId: element.id,
            issues: [],
            status: "error",
          };
        }

        const result = await analyzeResponse.json();
        return {
          elementId: element.id,
          issues: result.issues || [],
          status: "complete",
        };
      } catch {
        return {
          elementId: element.id,
          issues: [],
          status: "error",
        };
      }
    },
    []
  );

  /**
   * Run the scan loop
   */
  const runScanLoop = useCallback(
    async (elements: ScannedElement[], startIndex: number) => {
      // Group elements by source file to avoid duplicate scans
      const fileToElements = new Map<string, ScannedElement[]>();
      const scannedFiles = new Set<string>();

      for (const el of elements) {
        if (el.source) {
          const file = el.source.fileName;
          const existing = fileToElements.get(file) || [];
          existing.push(el);
          fileToElements.set(file, existing);
        }
      }

      for (let i = startIndex; i < elements.length; i++) {
        // Check abort
        if (scanAbortRef.current) {
          setAutoScanState((prev) => ({ ...prev, status: "idle" }));
          return;
        }

        // Check pause
        while (scanPausedRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (scanAbortRef.current) {
            setAutoScanState((prev) => ({ ...prev, status: "idle" }));
            return;
          }
        }

        const element = elements[i];

        // Update progress
        setAutoScanState((prev) => ({
          ...prev,
          currentIndex: i,
        }));

        // Skip if this file was already scanned
        if (element.source && scannedFiles.has(element.source.fileName)) {
          // Apply cached result from the first element with this file
          const existingElements = fileToElements.get(element.source.fileName);
          if (existingElements && existingElements.length > 0) {
            const firstId = existingElements[0].id;
            setElementIssuesCache((prev) => {
              const cached = prev.get(firstId);
              if (cached) {
                const newCache = new Map(prev);
                newCache.set(element.id, { ...cached, elementId: element.id });
                return newCache;
              }
              return prev;
            });
          }
          continue;
        }

        // Mark as scanning
        setElementIssuesCache((prev) => {
          const newCache = new Map(prev);
          newCache.set(element.id, {
            elementId: element.id,
            issues: [],
            status: "scanning",
          });
          return newCache;
        });

        // Scan the element
        const result = await scanElementForIssues(element);

        // Cache result
        setElementIssuesCache((prev) => {
          const newCache = new Map(prev);
          newCache.set(element.id, result);
          return newCache;
        });

        // Mark file as scanned
        if (element.source) {
          scannedFiles.add(element.source.fileName);
        }

        // Small delay to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Complete
      setAutoScanState((prev) => ({
        ...prev,
        status: "complete",
        currentIndex: elements.length,
      }));
    },
    [scanElementForIssues]
  );

  /**
   * Start auto-scanning all page elements
   */
  const startAutoScan = useCallback(() => {
    // Reset state
    scanPausedRef.current = false;
    scanAbortRef.current = false;

    // Get all scannable elements
    const elements = scanDOMForSources(document.body, settings.hideNodeModules);

    // Initialize cache with pending status for all elements
    const initialCache = new Map<string, ElementIssue>();
    for (const el of elements) {
      initialCache.set(el.id, {
        elementId: el.id,
        issues: [],
        status: "pending",
      });
    }
    setElementIssuesCache(initialCache);

    // Set initial state
    setAutoScanState({
      status: "scanning",
      currentIndex: 0,
      totalElements: elements.length,
      elements,
    });

    // Start the scan loop
    runScanLoop(elements, 0);
  }, [settings.hideNodeModules, runScanLoop]);

  /**
   * Pause the auto-scan
   */
  const pauseAutoScan = useCallback(() => {
    scanPausedRef.current = true;
    setAutoScanState((prev) => ({ ...prev, status: "paused" }));
  }, []);

  /**
   * Resume the auto-scan
   */
  const resumeAutoScan = useCallback(() => {
    scanPausedRef.current = false;
    setAutoScanState((prev) => {
      if (prev.status === "paused") {
        // Resume from current index
        runScanLoop(prev.elements, prev.currentIndex);
        return { ...prev, status: "scanning" };
      }
      return prev;
    });
  }, [runScanLoop]);

  /**
   * Stop and reset the auto-scan
   */
  const stopAutoScan = useCallback(() => {
    scanAbortRef.current = true;
    scanPausedRef.current = false;
    setAutoScanState(DEFAULT_AUTO_SCAN_STATE);
    setElementIssuesCache(new Map());
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
    [altKeyHeld, inspectedElement, getLocatorTargetFromElement]
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
   * Active when Alt is held OR when inspecting an element
   */
  useEffect(() => {
    if (!isBrowser() || !enabled) return;
    if (!altKeyHeld && !inspectedElement) return;

    window.addEventListener("mousemove", handleMouseMove);
    // Only add click handler when Alt is held (not during passive inspection hover)
    if (altKeyHeld) {
      window.addEventListener("click", handleLocatorClick, true);
    }

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
      autoScanState,
      elementIssuesCache,
      startAutoScan,
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
      autoScanState,
      elementIssuesCache,
      startAutoScan,
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

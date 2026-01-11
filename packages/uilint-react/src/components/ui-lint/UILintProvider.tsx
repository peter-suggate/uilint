"use client";

/**
 * UILint Provider - Context, state management, and keyboard shortcuts
 *
 * Provides Alt+Click element inspection functionality.
 * When Alt is held and hovering, shows element info tooltip.
 * When Alt+Click, opens the InspectionPanel sidebar.
 *
 * Uses data-loc attributes injected by the build plugin.
 * Works uniformly for both server and client components in Next.js 15+.
 *
 * State management is handled by Zustand store. This component provides:
 * - React Context for backwards compatibility with useUILintContext()
 * - DOM event handlers for Alt key, mouse tracking
 * - UI component mounting
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
  LocatorTarget,
} from "./types";
import { getSourceFromDataLoc, isNodeModulesPath } from "./dom-utils";
import { useUILintStore, type UILintStore } from "./store";
import { useDOMObserver } from "./useDOMObserver";

// Create context
const UILintContext = createContext<UILintContextValue | null>(null);

/**
 * Hook to detect navigation changes
 * Monitors pathname changes and fires callback with debounce
 */
function useNavigationDetection(
  enabled: boolean,
  onNavigate: (route: string, previousRoute: string | null) => void
) {
  const previousRouteRef = useRef<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || !isBrowser()) return;

    const checkNavigation = () => {
      const currentRoute = window.location.pathname;
      
      // Skip if same route
      if (currentRoute === previousRouteRef.current) return;
      
      const previousRoute = previousRouteRef.current;
      previousRouteRef.current = currentRoute;
      
      // Debounce to wait for DOM to settle
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      
      debounceRef.current = setTimeout(() => {
        onNavigate(currentRoute, previousRoute);
      }, 500); // 500ms debounce after navigation
    };

    // Initial check
    checkNavigation();

    // Listen for popstate (back/forward)
    window.addEventListener("popstate", checkNavigation);

    // Create a MutationObserver to detect soft navigations (Next.js app router)
    const observer = new MutationObserver(() => {
      checkNavigation();
    });

    // Observe URL changes via title or any navigation-related elements
    observer.observe(document.head, {
      subtree: true,
      childList: true,
    });

    // Also check periodically for URL changes (fallback)
    const intervalId = setInterval(checkNavigation, 1000);

    return () => {
      window.removeEventListener("popstate", checkNavigation);
      observer.disconnect();
      clearInterval(intervalId);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [enabled, onNavigate]);
}

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
  const locatorTarget = useUILintStore((s: UILintStore) => s.locatorTarget);
  const setLocatorTarget = useUILintStore(
    (s: UILintStore) => s.setLocatorTarget
  );
  const inspectedElement = useUILintStore(
    (s: UILintStore) => s.inspectedElement
  );
  const setInspectedElement = useUILintStore(
    (s: UILintStore) => s.setInspectedElement
  );
  const liveScanEnabled = useUILintStore((s: UILintStore) => s.liveScanEnabled);
  const autoScanState = useUILintStore((s: UILintStore) => s.autoScanState);
  const elementIssuesCache = useUILintStore(
    (s: UILintStore) => s.elementIssuesCache
  );
  const storeEnableLiveScan = useUILintStore(
    (s: UILintStore) => s.enableLiveScan
  );
  const disableLiveScan = useUILintStore((s: UILintStore) => s.disableLiveScan);

  // WebSocket (ESLint server) actions
  const connectWebSocket = useUILintStore(
    (s: UILintStore) => s.connectWebSocket
  );
  const disconnectWebSocket = useUILintStore(
    (s: UILintStore) => s.disconnectWebSocket
  );

  // Vision state
  const visionCurrentRoute = useUILintStore(
    (s: UILintStore) => s.visionCurrentRoute
  );

  // Mount DOM observer for navigation detection
  useDOMObserver(enabled && isMounted);

  // Navigation detection callback
  const handleNavigate = useCallback(
    (route: string, previousRoute: string | null) => {
      console.log("[UILint] Navigation detected:", { route, previousRoute });
      // For now, just log. Auto-capture can be enabled here later.
      // Future: if settings.autoVisionCapture, trigger vision analysis
    },
    []
  );

  // Use navigation detection
  useNavigationDetection(enabled && isMounted && liveScanEnabled, handleNavigate);

  /**
   * Get element info from a DOM element for locator mode
   * Uses data-loc attribute only (no fiber)
   */
  const getLocatorTargetFromElement = useCallback(
    (element: Element): LocatorTarget | null => {
      // Skip UILint's own UI elements
      if (element.closest("[data-ui-lint]")) return null;

      // Get source from data-loc attribute
      const source = getSourceFromDataLoc(element);

      // Skip if no source found
      if (!source) return null;

      // Skip node_modules if enabled
      if (settings.hideNodeModules && isNodeModulesPath(source.fileName)) {
        return null;
      }

      return {
        element,
        source,
        rect: element.getBoundingClientRect(),
      };
    },
    [settings.hideNodeModules]
  );

  /**
   * Handle mouse move for locator mode
   * Only active when Alt key is held down
   */
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!altKeyHeld) return;

      const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
      if (!elementAtPoint) {
        setLocatorTarget(null);
        return;
      }

      // Find the nearest element with source info (walking up the tree)
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
    [altKeyHeld, getLocatorTargetFromElement, setLocatorTarget]
  );

  /**
   * Handle click in locator mode - open sidebar
   * Only active when Alt key is held down
   */
  const handleLocatorClick = useCallback(
    (e: MouseEvent) => {
      // Only allow click-to-select when Alt is held
      if (!altKeyHeld || !locatorTarget) return;

      // Ignore clicks on UILint UI
      const targetEl = e.target as Element | null;
      if (targetEl?.closest?.("[data-ui-lint]")) return;

      e.preventDefault();
      e.stopPropagation();

      // Open the inspection panel sidebar
      setInspectedElement({
        element: locatorTarget.element,
        source: locatorTarget.source,
        rect: locatorTarget.rect,
      });

      // Reset locator state
      setLocatorTarget(null);
    },
    [altKeyHeld, locatorTarget, setInspectedElement, setLocatorTarget]
  );

  /**
   * Alt-key event handling
   */
  useEffect(() => {
    if (!isBrowser() || !enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        setAltKeyHeld(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        setAltKeyHeld(false);
        setLocatorTarget(null);
      }
    };

    // Handle window blur (alt-tab away)
    const handleBlur = () => {
      setAltKeyHeld(false);
      setLocatorTarget(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [enabled, setAltKeyHeld, setLocatorTarget]);

  /**
   * Mouse tracking for locator mode
   * Only active when Alt key is held down
   */
  useEffect(() => {
    if (!isBrowser() || !enabled) return;
    if (!altKeyHeld) return;

    window.addEventListener("mousemove", handleMouseMove);
    // Add click handler when Alt is held (click-to-select)
    window.addEventListener("click", handleLocatorClick, true);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleLocatorClick, true);
    };
  }, [enabled, altKeyHeld, handleMouseMove, handleLocatorClick]);

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
   * Auto-connect to the UILint WebSocket server for server-side ESLint results.
   * Connect only after hydration, and disconnect on unmount/disable.
   */
  useEffect(() => {
    if (!isBrowser() || !enabled) return;
    if (!isMounted) return;

    connectWebSocket();
    return () => {
      disconnectWebSocket();
    };
  }, [enabled, isMounted, connectWebSocket, disconnectWebSocket]);

  /**
   * Wrap enableLiveScan to pass hideNodeModules from settings
   */
  const enableLiveScan = useCallback(() => {
    storeEnableLiveScan(settings.hideNodeModules);
  }, [storeEnableLiveScan, settings.hideNodeModules]);

  /**
   * Context value - provides backwards compatibility with useUILintContext
   */
  const contextValue = useMemo<UILintContextValue>(
    () => ({
      settings,
      updateSettings,
      altKeyHeld,
      locatorTarget,
      inspectedElement,
      setInspectedElement,
      liveScanEnabled,
      autoScanState,
      elementIssuesCache,
      enableLiveScan,
      disableLiveScan,
    }),
    [
      settings,
      updateSettings,
      altKeyHeld,
      locatorTarget,
      inspectedElement,
      setInspectedElement,
      liveScanEnabled,
      autoScanState,
      elementIssuesCache,
      enableLiveScan,
      disableLiveScan,
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
  const { altKeyHeld, inspectedElement, liveScanEnabled } = useUILintContext();
  const visionIssuesCache = useUILintStore(
    (s: UILintStore) => s.visionIssuesCache
  );

  // Dynamically import components to avoid circular dependencies
  const [components, setComponents] = useState<{
    Toolbar: React.ComponentType;
    Panel: React.ComponentType;
    LocatorOverlay: React.ComponentType;
    InspectedHighlight: React.ComponentType;
    ElementBadges: React.ComponentType;
    VisionIssueBadges: React.ComponentType;
  } | null>(null);

  useEffect(() => {
    // Import components
    Promise.all([
      import("./UILintToolbar"),
      import("./InspectionPanel"),
      import("./LocatorOverlay"),
      import("./ElementBadges"),
      import("./VisionIssueBadge"),
    ]).then(([toolbar, panel, locator, badges, visionBadges]) => {
      setComponents({
        Toolbar: toolbar.UILintToolbar,
        Panel: panel.InspectionPanel,
        LocatorOverlay: locator.LocatorOverlay,
        InspectedHighlight: locator.InspectedElementHighlight,
        ElementBadges: badges.ElementBadges,
        VisionIssueBadges: visionBadges.VisionIssueBadges,
      });
    });
  }, []);

  if (!components) return null;

  const {
    Toolbar,
    Panel,
    LocatorOverlay,
    InspectedHighlight,
    ElementBadges,
    VisionIssueBadges,
  } = components;

  const hasVisionIssues = visionIssuesCache.size > 0;

  return (
    <>
      <Toolbar />
      {(altKeyHeld || inspectedElement) && <LocatorOverlay />}
      {liveScanEnabled && <ElementBadges />}
      {hasVisionIssues && <VisionIssueBadges />}
      {inspectedElement && (
        <>
          <InspectedHighlight />
          <Panel />
        </>
      )}
    </>
  );
}

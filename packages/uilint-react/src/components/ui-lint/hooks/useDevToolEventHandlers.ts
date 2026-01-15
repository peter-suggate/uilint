"use client";

/**
 * Hook for DevTool event handlers
 * Handles Alt key detection, mouse tracking for locator mode, and escape key
 */

import { useEffect, useCallback } from "react";
import { useUILintStore, type UILintStore } from "../store";
import { getSourceFromDataLoc, isNodeModulesPath } from "../dom-utils";
import type { LocatorTarget } from "../types";

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Hook for Alt key, mouse tracking, and escape key handling
 */
export function useDevToolEventHandlers(enabled: boolean) {
  // Get state from Zustand store
  const settings = useUILintStore((s: UILintStore) => s.settings);
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
}

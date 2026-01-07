"use client";

/**
 * DOM Observer Hook for Navigation Detection
 *
 * Watches the DOM for data-loc element additions/removals using MutationObserver.
 * This is useful for detecting page navigations in Next.js 15+ App Router apps
 * where server and client components may mount/unmount during navigation.
 *
 * Responsibilities:
 * 1. Watch DOM for data-loc element additions/removals
 * 2. Maintain registry of current elements
 * 3. Notify store of changes (debounced)
 * 4. Clean up on unmount
 */

import { useEffect, useRef, useCallback } from "react";
import { useUILintStore, type UILintStore } from "./store";

/** Debounce delay for reconciliation (handles streaming/suspense) */
const RECONCILE_DEBOUNCE_MS = 100;

/**
 * Hook to observe DOM changes and detect new/removed data-loc elements
 *
 * @param enabled - Whether observation is active
 */
export function useDOMObserver(enabled: boolean = true): void {
  const observerRef = useRef<MutationObserver | null>(null);
  const reconcileTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const lastScanElementIdsRef = useRef<Set<string>>(new Set());

  // Get store actions
  const setPendingNewElements = useUILintStore(
    (s: UILintStore) => s.setPendingNewElements
  );
  const removeStaleResults = useUILintStore(
    (s: UILintStore) => s.removeStaleResults
  );
  const autoScanState = useUILintStore((s: UILintStore) => s.autoScanState);

  // Update lastScanElementIds when a scan completes
  useEffect(() => {
    if (autoScanState.status === "complete") {
      const ids = new Set(autoScanState.elements.map((el) => el.id));
      lastScanElementIdsRef.current = ids;
    }
  }, [autoScanState.status, autoScanState.elements]);

  /**
   * Reconcile current DOM state with last scan results
   */
  const reconcileElements = useCallback(() => {
    // Get all current data-loc elements
    const currentElements = document.querySelectorAll("[data-loc]");
    const currentIds = new Set<string>();

    for (const el of currentElements) {
      const dataLoc = el.getAttribute("data-loc");
      if (dataLoc) {
        currentIds.add(`loc:${dataLoc}`);
      }
    }

    const lastScanIds = lastScanElementIdsRef.current;

    // If no previous scan, nothing to compare
    if (lastScanIds.size === 0) return;

    // Find new elements (in DOM but not in last scan)
    const newElementIds: string[] = [];
    for (const id of currentIds) {
      if (!lastScanIds.has(id)) {
        newElementIds.push(id);
      }
    }

    // Find removed elements (in last scan but not in DOM)
    const removedElementIds: string[] = [];
    for (const id of lastScanIds) {
      if (!currentIds.has(id)) {
        removedElementIds.push(id);
      }
    }

    // Update store with changes
    if (newElementIds.length > 0) {
      setPendingNewElements(newElementIds.length);
    }

    if (removedElementIds.length > 0) {
      removeStaleResults(removedElementIds);
    }
  }, [setPendingNewElements, removeStaleResults]);

  /**
   * Debounced reconciliation to handle rapid DOM updates
   */
  const debouncedReconcile = useCallback(() => {
    if (reconcileTimeoutRef.current) {
      clearTimeout(reconcileTimeoutRef.current);
    }
    reconcileTimeoutRef.current = setTimeout(() => {
      reconcileElements();
      reconcileTimeoutRef.current = null;
    }, RECONCILE_DEBOUNCE_MS);
  }, [reconcileElements]);

  /**
   * Set up MutationObserver
   */
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const observer = new MutationObserver((mutations) => {
      let hasRelevantChanges = false;

      for (const mutation of mutations) {
        // Check added nodes for data-loc
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            // Check the node itself
            if (node.hasAttribute("data-loc")) {
              hasRelevantChanges = true;
              break;
            }
            // Check descendant elements
            if (node.querySelector("[data-loc]")) {
              hasRelevantChanges = true;
              break;
            }
          }
        }

        if (hasRelevantChanges) break;

        // Check removed nodes for data-loc
        for (const node of mutation.removedNodes) {
          if (node instanceof Element) {
            if (
              node.hasAttribute("data-loc") ||
              node.querySelector("[data-loc]")
            ) {
              hasRelevantChanges = true;
              break;
            }
          }
        }

        if (hasRelevantChanges) break;
      }

      if (hasRelevantChanges) {
        debouncedReconcile();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    observerRef.current = observer;

    return () => {
      observer.disconnect();
      observerRef.current = null;

      if (reconcileTimeoutRef.current) {
        clearTimeout(reconcileTimeoutRef.current);
        reconcileTimeoutRef.current = null;
      }
    };
  }, [enabled, debouncedReconcile]);
}

/**
 * Get the current count of data-loc elements in the DOM
 */
export function getDataLocElementCount(): number {
  if (typeof document === "undefined") return 0;
  return document.querySelectorAll("[data-loc]").length;
}

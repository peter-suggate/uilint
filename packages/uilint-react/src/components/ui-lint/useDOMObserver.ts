"use client";

/**
 * DOM Observer Hook for Live Scanning
 *
 * Watches the DOM for data-loc element additions/removals using MutationObserver.
 * When live scanning is enabled:
 * - New elements are automatically scanned
 * - Removed elements are cleared from the cache
 *
 * This enables continuous scanning without manual rescan.
 */

import { useEffect, useRef, useCallback } from "react";
import { useUILintStore, type UILintStore } from "./store";
import { scanDOMForSources } from "./dom-utils";
import type { ScannedElement } from "./types";
import { DATA_UILINT_ID } from "./types";

/** Debounce delay for reconciliation (handles streaming/suspense) */
const RECONCILE_DEBOUNCE_MS = 100;

/**
 * Hook to observe DOM changes and auto-scan new data-loc elements
 *
 * @param enabled - Whether observation is active
 */
export function useDOMObserver(enabled: boolean = true): void {
  const observerRef = useRef<MutationObserver | null>(null);
  const reconcileTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const knownElementIdsRef = useRef<Set<string>>(new Set());

  // Get store state and actions
  const liveScanEnabled = useUILintStore((s: UILintStore) => s.liveScanEnabled);
  const settings = useUILintStore((s: UILintStore) => s.settings);
  const autoScanState = useUILintStore((s: UILintStore) => s.autoScanState);
  const removeStaleResults = useUILintStore(
    (s: UILintStore) => s.removeStaleResults
  );
  const scanNewElements = useUILintStore((s: UILintStore) => s.scanNewElements);

  // Update known element IDs when autoScanState changes
  useEffect(() => {
    if (autoScanState.elements.length > 0) {
      const ids = new Set(autoScanState.elements.map((el) => el.id));
      knownElementIdsRef.current = ids;
    }
  }, [autoScanState.elements]);

  /**
   * Reconcile current DOM state with known elements
   * - Scan new elements if live mode is enabled
   * - Remove stale results for elements no longer in DOM
   */
  const reconcileElements = useCallback(() => {
    // Don't reconcile if live scanning is not enabled
    if (!liveScanEnabled) return;

    // Get all current data-loc elements
    const currentElements = scanDOMForSources(
      document.body,
      settings.hideNodeModules
    );
    const currentIds = new Set(currentElements.map((el) => el.id));
    const knownIds = knownElementIdsRef.current;

    // Find new elements (in DOM but not known)
    const newElements: ScannedElement[] = [];
    for (const el of currentElements) {
      if (!knownIds.has(el.id)) {
        newElements.push(el);
      }
    }

    // Find removed elements (known but not in DOM)
    const removedElementIds: string[] = [];
    for (const id of knownIds) {
      if (!currentIds.has(id)) {
        removedElementIds.push(id);
      }
    }

    // Update known IDs
    knownElementIdsRef.current = currentIds;

    // Scan new elements
    if (newElements.length > 0) {
      scanNewElements(newElements);
    }

    // Remove stale results
    if (removedElementIds.length > 0) {
      removeStaleResults(removedElementIds);
    }
  }, [
    liveScanEnabled,
    settings.hideNodeModules,
    scanNewElements,
    removeStaleResults,
  ]);

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
            if (node.hasAttribute(DATA_UILINT_ID)) {
              hasRelevantChanges = true;
              break;
            }
            // Check descendant elements
            if (node.querySelector(`[${DATA_UILINT_ID}]`)) {
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
              node.hasAttribute(DATA_UILINT_ID) ||
              node.querySelector(`[${DATA_UILINT_ID}]`)
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
  return document.querySelectorAll(`[${DATA_UILINT_ID}]`).length;
}

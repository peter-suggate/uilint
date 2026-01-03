"use client";

/**
 * Hook for managing element scanning state and results
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScannedElement, SourceFile, UILintSettings } from "./types";
import {
  scanDOMForSources,
  groupBySourceFile,
  updateElementRects,
  cleanupDataAttributes,
} from "./fiber-utils";

interface UseElementScanOptions {
  enabled: boolean;
  settings: UILintSettings;
}

interface UseElementScanResult {
  elements: ScannedElement[];
  sourceFiles: SourceFile[];
  isScanning: boolean;
  rescan: () => void;
}

/**
 * Debounce helper
 */
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Hook for managing element scanning
 */
export function useElementScan({
  enabled,
  settings,
}: UseElementScanOptions): UseElementScanResult {
  const [elements, setElements] = useState<ScannedElement[]>([]);
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const mutationObserverRef = useRef<MutationObserver | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  /**
   * Perform the scan
   */
  const performScan = useCallback(() => {
    if (!enabled || typeof window === "undefined") return;

    setIsScanning(true);

    // Use requestIdleCallback for non-blocking scan
    const scan = () => {
      try {
        const scannedElements = scanDOMForSources(
          document.body,
          settings.hideNodeModules
        );
        const files = groupBySourceFile(scannedElements);

        setElements(scannedElements);
        setSourceFiles(files);
      } catch (error) {
        console.error("[UILint] Scan error:", error);
      } finally {
        setIsScanning(false);
      }
    };

    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(scan, { timeout: 1000 });
    } else {
      setTimeout(scan, 0);
    }
  }, [enabled, settings.hideNodeModules]);

  /**
   * Update element positions (for scroll/resize)
   */
  const updatePositions = useCallback(() => {
    if (elements.length === 0) return;
    setElements((prev) => updateElementRects(prev));
  }, [elements.length]);

  /**
   * Debounced rescan for DOM mutations
   */
  const debouncedRescan = useCallback(
    debounce(() => {
      performScan();
    }, 500),
    [performScan]
  );

  /**
   * Handle scroll events
   */
  const handleScroll = useCallback(
    debounce(() => {
      updatePositions();
    }, 16), // ~60fps
    [updatePositions]
  );

  /**
   * Handle resize events
   */
  const handleResize = useCallback(
    debounce(() => {
      updatePositions();
    }, 100),
    [updatePositions]
  );

  /**
   * Initial scan and setup observers
   */
  useEffect(() => {
    if (!enabled) {
      cleanupDataAttributes();
      setElements([]);
      setSourceFiles([]);
      return;
    }

    // Initial scan after a short delay to let the page render
    const initialScanTimer = setTimeout(performScan, 100);

    // Set up MutationObserver
    mutationObserverRef.current = new MutationObserver((mutations) => {
      // Filter out mutations from our own data attributes
      const hasRelevantMutation = mutations.some((mutation) => {
        if (mutation.type === "attributes") {
          return !mutation.attributeName?.startsWith("data-ui-lint");
        }
        return true;
      });

      if (hasRelevantMutation) {
        debouncedRescan();
      }
    });

    mutationObserverRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    // Set up scroll and resize listeners
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(initialScanTimer);
      mutationObserverRef.current?.disconnect();
      resizeObserverRef.current?.disconnect();
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
      cleanupDataAttributes();
    };
  }, [enabled, performScan, debouncedRescan, handleScroll, handleResize]);

  /**
   * Re-scan when hideNodeModules setting changes
   */
  useEffect(() => {
    if (enabled && elements.length > 0) {
      performScan();
    }
  }, [settings.hideNodeModules]);

  return {
    elements,
    sourceFiles,
    isScanning,
    rescan: performScan,
  };
}

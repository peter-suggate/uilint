import { useState, useEffect, useCallback, useRef } from "react";

interface ElementRect {
  dataLoc: string;
  rect: DOMRect;
  element: Element;
}

/**
 * Hook that tracks DOM element positions for heatmap overlay
 *
 * Updates positions when:
 * - Scroll or resize events fire
 * - DOM elements with data-loc are added/removed/changed
 * - Document margin changes (inspector dock/undock)
 *
 * @param dataLocs - Set or Map of dataLoc strings to track
 */
export function useElementRects(
  dataLocs: Set<string> | Map<string, unknown> | undefined
) {
  const [rects, setRects] = useState<Map<string, ElementRect>>(new Map());
  const observerRef = useRef<MutationObserver | null>(null);
  const styleObserverRef = useRef<MutationObserver | null>(null);
  const rafRef = useRef<number | null>(null);

  const updateRects = useCallback(() => {
    if (!dataLocs) {
      setRects(new Map());
      return;
    }

    const dataLocSet =
      dataLocs instanceof Set ? dataLocs : new Set(dataLocs.keys());

    if (dataLocSet.size === 0) {
      setRects(new Map());
      return;
    }

    const newRects = new Map<string, ElementRect>();
    const elements = document.querySelectorAll("[data-loc]");

    elements.forEach((el) => {
      const dataLoc = el.getAttribute("data-loc");
      if (dataLoc && dataLocSet.has(dataLoc)) {
        const rect = el.getBoundingClientRect();
        // Only include visible elements
        if (rect.width > 0 && rect.height > 0) {
          newRects.set(dataLoc, { dataLoc, rect, element: el });
        }
      }
    });

    setRects(newRects);
  }, [dataLocs]);

  // Throttled update for scroll/resize/style changes
  const throttledUpdate = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      updateRects();
      rafRef.current = null;
    });
  }, [updateRects]);

  useEffect(() => {
    updateRects();

    // Update on scroll and resize
    window.addEventListener("scroll", throttledUpdate, { passive: true });
    window.addEventListener("resize", throttledUpdate, { passive: true });

    // Watch for DOM changes in body
    observerRef.current = new MutationObserver(throttledUpdate);
    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-loc"],
    });

    // Watch for style changes on document.documentElement (margin changes from inspector dock)
    styleObserverRef.current = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "style") {
          throttledUpdate();
          break;
        }
      }
    });
    styleObserverRef.current.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => {
      window.removeEventListener("scroll", throttledUpdate);
      window.removeEventListener("resize", throttledUpdate);
      observerRef.current?.disconnect();
      styleObserverRef.current?.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [updateRects, throttledUpdate]);

  return rects;
}

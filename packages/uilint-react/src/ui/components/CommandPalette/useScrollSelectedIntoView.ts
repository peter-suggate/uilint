import { createContext, useContext, useEffect, useRef, useCallback } from "react";
import type { RefCallback } from "react";

/**
 * Context that holds the scroll-into-view registration map.
 * Any navigable item calls `useScrollTarget(index)` to self-register,
 * regardless of how deeply nested it is in the component tree.
 */

interface ScrollSelectedContextValue {
  register: (index: number, el: HTMLElement | null) => void;
}

export const ScrollSelectedContext = createContext<ScrollSelectedContextValue | null>(null);

/**
 * Hook consumed by the list owner (CommandPalette).
 * Returns the context value to pass to `ScrollSelectedContext.Provider`.
 *
 * Scrolls the element at `selectedIndex` into view whenever it changes.
 */
export function useScrollSelectedIntoView(selectedIndex: number): ScrollSelectedContextValue {
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());

  useEffect(() => {
    const el = itemRefs.current.get(selectedIndex);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex]);

  const register = useCallback((index: number, el: HTMLElement | null) => {
    if (el) {
      itemRefs.current.set(index, el);
    } else {
      itemRefs.current.delete(index);
    }
  }, []);

  return { register };
}

/**
 * Hook consumed by each navigable item to self-register for scroll tracking.
 * Returns a ref callback to attach to the item's root DOM element.
 *
 * Usage:
 *   const scrollRef = useScrollTarget(index);
 *   <div ref={scrollRef}>...</div>
 */
export function useScrollTarget(index: number): RefCallback<HTMLElement> {
  const ctx = useContext(ScrollSelectedContext);

  const refCallback: RefCallback<HTMLElement> = useCallback(
    (el) => {
      ctx?.register(index, el);
    },
    [ctx, index]
  );

  return refCallback;
}

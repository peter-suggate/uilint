import { useEffect, useRef } from "react";

/**
 * Hook that scrolls the DOM element at `selectedIndex` into view whenever
 * the index changes.  Returns a ref-map that consumers populate via
 * callback-refs on each list item.
 *
 * Usage:
 *   const itemRefs = useScrollSelectedIntoView(selectedIndex);
 *   <div ref={el => { if (el) itemRefs.current.set(i, el); else itemRefs.current.delete(i); }} />
 */
export function useScrollSelectedIntoView(selectedIndex: number) {
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());

  useEffect(() => {
    const el = itemRefs.current.get(selectedIndex);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex]);

  return itemRefs;
}

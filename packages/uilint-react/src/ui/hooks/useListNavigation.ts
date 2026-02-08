/**
 * useListNavigation - 1D keyboard navigation for the command palette result list
 *
 * Replaces useTileNavigation (2D grid) with a simple up/down list navigation.
 * Supports: ArrowDown/Up, Enter, Escape, Tab, Home/End.
 */

import { useCallback, useEffect } from "react";
import type { SearchItem } from "../../core/plugin-system/types";

// ============================================================================
// Types
// ============================================================================

export interface UseListNavigationOptions {
  /** Flattened list of items in display order */
  flatItems: SearchItem[];
  /** Current selected index */
  selectedIndex: number;
  /** Callback to update selected index and item ID */
  onSelect: (index: number, itemId: string | null) => void;
  /** Callback when Enter is pressed on the selected item */
  onConfirm: (item: SearchItem) => void;
  /** Callback when Escape is pressed */
  onEscape?: () => void;
  /** Callback when Tab is pressed (toggle preview focus) */
  onTabToggle?: () => void;
}

export interface UseListNavigationReturn {
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useListNavigation({
  flatItems,
  selectedIndex,
  onSelect,
  onConfirm,
  onEscape,
  onTabToggle,
}: UseListNavigationOptions): UseListNavigationReturn {
  // Reset selection when items change
  useEffect(() => {
    if (flatItems.length > 0 && selectedIndex >= flatItems.length) {
      onSelect(0, flatItems[0]?.id ?? null);
    }
  }, [flatItems, selectedIndex, onSelect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const count = flatItems.length;
      if (count === 0 && e.key !== "Escape") return;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = Math.min(selectedIndex + 1, count - 1);
          onSelect(next, flatItems[next]?.id ?? null);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prev = Math.max(selectedIndex - 1, 0);
          onSelect(prev, flatItems[prev]?.id ?? null);
          break;
        }
        case "Enter": {
          e.preventDefault();
          const item = flatItems[selectedIndex];
          if (item) onConfirm(item);
          break;
        }
        case "Escape": {
          e.preventDefault();
          onEscape?.();
          break;
        }
        case "Tab": {
          e.preventDefault();
          onTabToggle?.();
          break;
        }
        case "Home": {
          e.preventDefault();
          if (count > 0) {
            onSelect(0, flatItems[0]?.id ?? null);
          }
          break;
        }
        case "End": {
          e.preventDefault();
          if (count > 0) {
            const last = count - 1;
            onSelect(last, flatItems[last]?.id ?? null);
          }
          break;
        }
      }
    },
    [flatItems, selectedIndex, onSelect, onConfirm, onEscape, onTabToggle]
  );

  return { handleKeyDown };
}

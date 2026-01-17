/**
 * Keyboard navigation hook for command palette
 */

import { useEffect, useCallback } from "react";
import type { KeyboardNavigationOptions } from "./types";

/**
 * Hook to handle keyboard navigation in command palette
 */
export function useKeyboardNavigation({
  isOpen,
  itemCount,
  selectedIndex,
  onSelect,
  onIndexChange,
  onClose,
}: KeyboardNavigationOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          onIndexChange(Math.min(selectedIndex + 1, itemCount - 1));
          break;

        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          onIndexChange(Math.max(selectedIndex - 1, 0));
          break;

        case "Enter":
          e.preventDefault();
          e.stopPropagation();
          if (itemCount > 0) {
            onSelect(selectedIndex);
          }
          break;

        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
      }
    },
    [isOpen, itemCount, selectedIndex, onSelect, onIndexChange, onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    // Use capture phase to intercept before other handlers
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen, handleKeyDown]);

  // Reset index when item count changes
  useEffect(() => {
    if (selectedIndex >= itemCount && itemCount > 0) {
      onIndexChange(itemCount - 1);
    }
  }, [itemCount, selectedIndex, onIndexChange]);
}

/**
 * Hook to detect Cmd+K / Ctrl+K to open command palette
 */
export function useCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        onOpen();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [onOpen]);
}

/**
 * useTileNavigation - 2D keyboard navigation for tile grids
 *
 * Handles arrow key navigation in a grid layout with configurable columns,
 * plus Enter to select, Backspace to go back, and Home/End for quick jumps.
 */

import { useState, useCallback, useEffect } from "react";
import type { TileItem } from "../../core/plugin-system/types";

export interface UseTileNavigationReturn {
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

export function useTileNavigation(
  items: TileItem[],
  columns: number,
  onSelect: (item: TileItem) => void,
  onBack?: () => void
): UseTileNavigationReturn {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset index to 0 when items array changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const itemCount = items.length;
      if (itemCount === 0) return;

      // Helper to clamp index within bounds
      const clamp = (index: number) => Math.max(0, Math.min(index, itemCount - 1));

      // Get current row position
      const currentRow = Math.floor(selectedIndex / columns);
      const currentCol = selectedIndex % columns;
      const rowStart = currentRow * columns;
      const rowEnd = Math.min(rowStart + columns - 1, itemCount - 1);

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const newIndex = selectedIndex + columns;
          // Wrap to start if past end
          if (newIndex >= itemCount) {
            setSelectedIndex(currentCol < itemCount ? currentCol : 0);
          } else {
            setSelectedIndex(newIndex);
          }
          break;
        }

        case "ArrowUp": {
          e.preventDefault();
          const newIndex = selectedIndex - columns;
          // Wrap to end if before start
          if (newIndex < 0) {
            // Find the last row's equivalent position
            const totalRows = Math.ceil(itemCount / columns);
            const lastRowStart = (totalRows - 1) * columns;
            const lastRowIndex = lastRowStart + currentCol;
            setSelectedIndex(clamp(lastRowIndex));
          } else {
            setSelectedIndex(newIndex);
          }
          break;
        }

        case "ArrowLeft": {
          e.preventDefault();
          // Stop at row start
          if (selectedIndex > rowStart) {
            setSelectedIndex(selectedIndex - 1);
          }
          break;
        }

        case "ArrowRight": {
          e.preventDefault();
          // Stop at row end
          if (selectedIndex < rowEnd) {
            setSelectedIndex(selectedIndex + 1);
          }
          break;
        }

        case "Enter": {
          e.preventDefault();
          const item = items[selectedIndex];
          if (item) {
            onSelect(item);
          }
          break;
        }

        case "Backspace": {
          if (onBack) {
            e.preventDefault();
            onBack();
          }
          break;
        }

        case "Home": {
          e.preventDefault();
          setSelectedIndex(0);
          break;
        }

        case "End": {
          e.preventDefault();
          setSelectedIndex(itemCount - 1);
          break;
        }

        default:
          // Don't prevent default for unhandled keys
          break;
      }
    },
    [items, columns, selectedIndex, onSelect, onBack]
  );

  return {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
  };
}

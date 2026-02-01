/**
 * TileGrid - Bin-packing mosaic grid for tiles
 *
 * Features:
 * - True masonry layout with absolute positioning
 * - Places largest tiles first, fills vertical gaps
 * - Staggered entrance animations
 * - Empty state handling
 */
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import type { TileItem } from "../../../core/plugin-system/types";
import { Tile } from "./Tile";
import { calculateMosaicLayout } from "./layout";

interface TileGridProps {
  items: TileItem[];
  onTileClick: (item: TileItem) => void;
  selectedIndex: number;
  isTerminal?: boolean;
}

/**
 * Crisp easing curve for animations
 */
const crispEase = [0.32, 0.72, 0, 1] as const;

/**
 * Available width for tile grid (fixed command palette width minus padding)
 */
const GRID_AVAILABLE_WIDTH = 500;

/**
 * Gap between tiles
 */
const GRID_GAP = 12;

/**
 * EmptyState - Placeholder when no tiles to display
 */
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
        color: "rgba(255, 255, 255, 0.5)",
      }}
    >
      <div
        style={{
          fontSize: 32,
          marginBottom: 12,
          opacity: 0.5,
        }}
      >
        {"\u2728"}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 400,
          color: "rgba(255, 255, 255, 0.7)",
          marginBottom: 4,
        }}
      >
        No items to display
      </div>
      <div
        style={{
          fontSize: 12,
          color: "rgba(255, 255, 255, 0.4)",
        }}
      >
        Try adjusting your filters or search query
      </div>
    </motion.div>
  );
}

export function TileGrid({
  items,
  onTileClick,
  selectedIndex,
  isTerminal = false,
}: TileGridProps) {
  // Calculate layout based on items
  const layout = React.useMemo(
    () =>
      calculateMosaicLayout(items, {
        availableWidth: GRID_AVAILABLE_WIDTH,
        gap: GRID_GAP,
      }),
    [items]
  );

  // Handle empty state
  if (items.length === 0) {
    return <EmptyState />;
  }

  // Sort items by y position for proper stagger animation
  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
      const layoutA = layout.tiles.get(a.id);
      const layoutB = layout.tiles.get(b.id);
      const yDiff = (layoutA?.y ?? 0) - (layoutB?.y ?? 0);
      if (Math.abs(yDiff) > 10) return yDiff;
      return (layoutA?.x ?? 0) - (layoutB?.x ?? 0);
    });
  }, [items, layout]);

  // Build index lookup for selection
  const itemIndexMap = React.useMemo(() => {
    const map = new Map<string, number>();
    sortedItems.forEach((item, index) => map.set(item.id, index));
    return map;
  }, [sortedItems]);

  return (
    <div
      style={{
        padding: "12px 16px",
        position: "relative",
        height: layout.totalHeight,
        minHeight: 200,
      }}
    >
      <AnimatePresence mode="popLayout">
        {sortedItems.map((item, animIndex) => {
          const tileLayout = layout.tiles.get(item.id);
          if (!tileLayout) return null;

          const globalIndex = itemIndexMap.get(item.id) ?? animIndex;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                duration: 0.2,
                ease: crispEase,
                delay: Math.min(animIndex * 0.03, 0.2),
              }}
              style={{
                position: "absolute",
                left: tileLayout.x,
                top: tileLayout.y,
                width: tileLayout.width,
                height: tileLayout.height,
              }}
            >
              <Tile
                item={item}
                bucket={tileLayout.bucket}
                isSelected={globalIndex === selectedIndex}
                onClick={() => onTileClick(item)}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export type { TileGridProps };

/**
 * TileGrid - Bin-packing mosaic grid for tiles
 *
 * Features:
 * - True masonry layout with absolute positioning
 * - Places largest tiles first, fills vertical gaps
 * - Staggered entrance animations
 * - Glassmorphic empty state with proper light/dark mode support
 */
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles } from "lucide-react";
import { cn } from "../../../lib/utils";
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
 * Available width for tile grid
 * Command palette: 580px - padding: 48px = 532px
 */
const GRID_AVAILABLE_WIDTH = 532;

/**
 * Gap between tiles
 */
const GRID_GAP = 14;

/**
 * EmptyState - Minimal placeholder when no tiles to display
 */
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex flex-col items-center justify-center",
        "py-16 px-8 text-center"
      )}
    >
      <div className="mb-4 opacity-30">
        <Sparkles size={28} strokeWidth={1.5} />
      </div>
      <div className="text-sm font-normal text-foreground/60 mb-1">
        No items to display
      </div>
      <div className="text-xs text-muted-foreground/70">
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
  // Handle empty state early (no hooks needed)
  if (items.length === 0) {
    return <EmptyState />;
  }

  // Single memoized computation for layout, sorted items, and index map
  const { layout, sortedItems, itemIndexMap } = React.useMemo(() => {
    const computedLayout = calculateMosaicLayout(items, {
      availableWidth: GRID_AVAILABLE_WIDTH,
      gap: GRID_GAP,
    });

    // Sort items by y position for proper stagger animation
    const sorted = [...items].sort((a, b) => {
      const layoutA = computedLayout.tiles.get(a.id);
      const layoutB = computedLayout.tiles.get(b.id);
      const yDiff = (layoutA?.y ?? 0) - (layoutB?.y ?? 0);
      if (Math.abs(yDiff) > 10) return yDiff;
      return (layoutA?.x ?? 0) - (layoutB?.x ?? 0);
    });

    // Build index lookup for selection
    const indexMap = new Map<string, number>();
    sorted.forEach((item, index) => indexMap.set(item.id, index));

    return { layout: computedLayout, sortedItems: sorted, itemIndexMap: indexMap };
  }, [items]);

  return (
    <div
      className="p-5 px-6 relative"
      style={{
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
              className="absolute"
              style={{
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

/**
 * TileGrid - Bin-packing mosaic grid for tiles
 *
 * Features:
 * - True masonry layout with absolute positioning
 * - Places largest tiles first, fills vertical gaps
 * - Staggered entrance animations
 * - Glassmorphic empty state with proper light/dark mode support
 * - Generic item type support
 */
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles } from "lucide-react";
import { cn } from "../../../lib/utils";
import { Tile } from "./Tile";
import { calculateMosaicLayout } from "./layout";
import { crispEase } from "./animations";

// ============================================================================
// Types
// ============================================================================

/**
 * Base item type that TileGrid can work with.
 * Items must have at minimum an id, label, and count.
 * Optional properties match the Tile component's props.
 */
export interface BaseTileItem {
  id: string;
  label: string;
  count: number;
  subtitle?: string;
  icon?: React.ReactNode;
  severityCounts?: { error: number; warning: number; info: number };
}

export interface TileGridProps<T extends BaseTileItem> {
  items: T[];
  onTileClick: (item: T) => void;
  onOpenInInspector?: (item: T) => void;
  selectedIndex: number;
  isTerminal?: boolean;
  /** Override the available width for layout (default: 532) */
  availableWidth?: number;
  /** Override padding (default: { top: 20, right: 24, bottom: 20, left: 24 }) */
  padding?: { top: number; right: number; bottom: number; left: number };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Command palette width: 580px
 * Grid padding: 24px on each side
 * Available width for tiles: 580 - 48 = 532px
 */
const GRID_PADDING = { top: 20, right: 24, bottom: 20, left: 24 };
const GRID_AVAILABLE_WIDTH = 532;
const GRID_GAP = 14;

// ============================================================================
// Sub-components
// ============================================================================

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

// ============================================================================
// Main Component
// ============================================================================

export function TileGrid<T extends BaseTileItem>({
  items,
  onTileClick,
  onOpenInInspector,
  selectedIndex,
  isTerminal = false,
  availableWidth = GRID_AVAILABLE_WIDTH,
  padding = GRID_PADDING,
}: TileGridProps<T>) {
  // Handle empty state early (no hooks needed)
  if (items.length === 0) {
    return <EmptyState />;
  }

  // Single memoized computation for layout, sorted items, and index map
  const { layout, sortedItems, itemIndexMap } = React.useMemo(() => {
    const computedLayout = calculateMosaicLayout(items, {
      availableWidth,
      gap: GRID_GAP,
      padding,
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
  }, [items, availableWidth, padding]);

  return (
    <div
      className="relative"
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
                id={item.id}
                label={item.label}
                subtitle={item.subtitle}
                icon={item.icon}
                count={item.count}
                severityCounts={item.severityCounts}
                bucket={tileLayout.bucket}
                isSelected={globalIndex === selectedIndex}
                onClick={() => onTileClick(item)}
                onOpenInInspector={onOpenInInspector ? () => onOpenInInspector(item) : undefined}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

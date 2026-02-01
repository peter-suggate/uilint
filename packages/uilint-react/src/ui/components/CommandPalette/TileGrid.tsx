/**
 * TileGrid - Flexbox-based mosaic grid for tiles
 *
 * Features:
 * - Special layouts for 1-4 items (hero, pair, trio, quad)
 * - Responsive grid for 5+ items
 * - Percentile-based bucket sizing for tile heights
 * - Staggered entrance animations
 * - Empty state handling
 */
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import type { TileItem } from "../../../core/plugin-system/types";
import { Tile } from "./Tile";
import {
  calculateMosaicLayout,
  groupTilesByRow,
  type MosaicLayoutResult,
} from "./layout";

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
        color: "var(--uilint-text-muted)",
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
          fontWeight: 500,
          color: "var(--uilint-text-secondary)",
          marginBottom: 4,
        }}
      >
        No items to display
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--uilint-text-muted)",
        }}
      >
        Try adjusting your filters or search query
      </div>
    </motion.div>
  );
}

/**
 * TileRow - Renders a single row of tiles
 */
function TileRow({
  items,
  layout,
  onTileClick,
  selectedIndex,
  startIndex,
}: {
  items: TileItem[];
  layout: MosaicLayoutResult;
  onTileClick: (item: TileItem) => void;
  selectedIndex: number;
  startIndex: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: GRID_GAP,
        marginBottom: GRID_GAP,
      }}
    >
      {items.map((item, indexInRow) => {
        const tileLayout = layout.tiles.get(item.id);
        const globalIndex = startIndex + indexInRow;

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: 0.15,
              ease: crispEase,
              delay: Math.min(globalIndex * 0.05, 0.3),
            }}
            layout
            style={{
              width: tileLayout?.width ?? "100%",
              flexShrink: 0,
            }}
          >
            <Tile
              item={item}
              bucket={tileLayout?.bucket ?? "md"}
              isSelected={globalIndex === selectedIndex}
              onClick={() => onTileClick(item)}
            />
          </motion.div>
        );
      })}
    </div>
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

  // Group items by row for rendering
  const rows = React.useMemo(
    () => groupTilesByRow(items, layout),
    [items, layout]
  );

  // Handle empty state
  if (items.length === 0) {
    return <EmptyState />;
  }

  // Track cumulative index for selection highlighting
  let cumulativeIndex = 0;

  return (
    <div
      style={{
        padding: "12px 16px",
      }}
    >
      <AnimatePresence mode="popLayout">
        {rows.map((rowItems, rowIndex) => {
          const startIndex = cumulativeIndex;
          cumulativeIndex += rowItems.length;

          return (
            <TileRow
              key={`row-${rowIndex}`}
              items={rowItems}
              layout={layout}
              onTileClick={onTileClick}
              selectedIndex={selectedIndex}
              startIndex={startIndex}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export type { TileGridProps };

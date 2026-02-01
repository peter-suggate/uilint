/**
 * TileGrid - Masonry grid container for tiles
 *
 * Features:
 * - CSS columns-based masonry layout
 * - Responsive: 3 cols desktop, 2 cols tablet, 1 col mobile
 * - Normalized percentile-based bucket sizing
 * - Staggered entrance animations
 * - Empty state handling
 */
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import type { TileItem, TileBucket } from "../../../core/plugin-system/types";
import { Tile } from "./Tile";

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
 * Calculate bucket size based on normalized percentiles.
 *
 * Distribution:
 * - Top 10% by count = xl
 * - Next 20% = lg
 * - Next 30% = md
 * - Next 25% = sm
 * - Bottom 15% = xs
 */
function calculateBucket(count: number, sortedCounts: number[]): TileBucket {
  if (sortedCounts.length === 0) return "md";

  // Find the position of this count in the sorted array (descending)
  const total = sortedCounts.length;
  const position = sortedCounts.findIndex((c) => count >= c);
  const percentile = position === -1 ? 1 : position / total;

  // Map percentile to bucket
  if (percentile < 0.1) return "xl";     // Top 10%
  if (percentile < 0.3) return "lg";     // Next 20% (10-30%)
  if (percentile < 0.6) return "md";     // Next 30% (30-60%)
  if (percentile < 0.85) return "sm";    // Next 25% (60-85%)
  return "xs";                            // Bottom 15% (85-100%)
}

/**
 * Calculate buckets for all items
 */
function calculateBuckets(items: TileItem[]): Map<string, TileBucket> {
  // Sort counts in descending order for percentile calculation
  const sortedCounts = items
    .map((item) => item.count)
    .sort((a, b) => b - a);

  const buckets = new Map<string, TileBucket>();

  for (const item of items) {
    buckets.set(item.id, calculateBucket(item.count, sortedCounts));
  }

  return buckets;
}

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

export function TileGrid({
  items,
  onTileClick,
  selectedIndex,
  isTerminal = false,
}: TileGridProps) {
  // Calculate buckets based on normalized percentiles
  const buckets = React.useMemo(() => calculateBuckets(items), [items]);

  // Handle empty state
  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <div
      style={{
        padding: "12px 16px",
        columnCount: 3,
        columnGap: 12,
        // Responsive column counts using container queries would be ideal,
        // but we'll rely on media query-like behavior via CSS variables
      }}
    >
      <style>
        {`
          @media (max-width: 768px) {
            .uilint-tile-grid {
              column-count: 1 !important;
            }
          }
          @media (min-width: 769px) and (max-width: 1024px) {
            .uilint-tile-grid {
              column-count: 2 !important;
            }
          }
          @media (min-width: 1025px) {
            .uilint-tile-grid {
              column-count: 3 !important;
            }
          }
        `}
      </style>
      <div
        className="uilint-tile-grid"
        style={{
          columnCount: 3,
          columnGap: 12,
        }}
      >
        <AnimatePresence mode="popLayout">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                duration: 0.15,
                ease: crispEase,
                delay: Math.min(index * 0.05, 0.3), // 50ms stagger, max 300ms
              }}
              layout
            >
              <Tile
                item={item}
                bucket={buckets.get(item.id) || "md"}
                isSelected={index === selectedIndex}
                onClick={() => onTileClick(item)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export type { TileGridProps };

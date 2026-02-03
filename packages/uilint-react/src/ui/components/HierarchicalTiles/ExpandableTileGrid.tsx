/**
 * ExpandableTileGrid - Generic mosaic grid where tiles expand in-place
 *
 * A controlled component that renders a mosaic grid of tiles with in-place expansion.
 * When a tile is expanded:
 * - The tile expands IN PLACE to show its children inside it
 * - The expanded tile takes full width at its original row position
 * - Tiles that were beside it reflow below (since it now takes full width)
 * - Tiles that were already below also move down to accommodate
 *
 * This component is state-agnostic - it receives expansion state via props,
 * making it reusable across command palette, inspector, and other contexts.
 */
import React, { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
import { Tile } from "./Tile";
import { TileGrid } from "./TileGrid";
import { TileHeader } from "./TileHeader";
import { calculateMosaicLayout, calculateExpandedLayout } from "./layout";
import type { LayoutItem } from "./layout";
import type { BaseTileItem } from "./TileGrid";
import {
  childrenContainerVariants,
  crispEase,
  DURATIONS,
} from "./animations";

// ============================================================================
// Types
// ============================================================================

export interface ExpandableTileGridProps<T extends BaseTileItem> {
  /** Root-level tile items */
  items: T[];
  /** ID of the currently expanded tile, or null if none */
  expandedId: string | null;
  /** Children to show inside the expanded tile */
  expandedChildren: T[];
  /** Callback when a non-expanded tile is clicked */
  onTileClick: (item: T) => void;
  /** Callback when a child inside the expanded tile is clicked */
  onExpandedChildClick: (item: T) => void;
  /** Callback when the back button is clicked on the expanded tile */
  onBack: () => void;
  /** Available width for the grid */
  availableWidth: number;
  /** Currently selected index for keyboard navigation */
  selectedIndex?: number;
  /** Gap between tiles (default: 14) */
  gap?: number;
  /** Padding around the grid */
  padding?: { top: number; right: number; bottom: number; left: number };
  /** Extra height to add to expanded tile for custom content (RuleHeader, RuleConfig, etc.) */
  extraExpandedHeight?: number;
  /** Custom render function for expanded tile content */
  renderExpandedContent?: (
    item: T,
    children: T[],
    childrenHeight: number,
    availableWidth: number
  ) => React.ReactNode;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_GAP = 14;
const DEFAULT_PADDING = { top: 0, right: 0, bottom: 0, left: 0 };
const EXPANDED_HEADER_HEIGHT = 52;
const EXPANDED_CONTENT_PADDING = 12;

// ============================================================================
// Sub-components
// ============================================================================

interface DefaultExpandedContentProps<T extends BaseTileItem> {
  item: T;
  children: T[];
  childrenHeight: number;
  availableWidth: number;
  onBack: () => void;
  onChildClick: (item: T) => void;
}

function DefaultExpandedContent<T extends BaseTileItem>({
  item,
  children,
  childrenHeight,
  availableWidth,
  onBack,
  onChildClick,
}: DefaultExpandedContentProps<T>) {
  return (
    <motion.div
      layoutId={`tile-${item.id}`}
      initial={{ opacity: 0.9 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0.9 }}
      transition={{ duration: DURATIONS.expand, ease: crispEase }}
      className={cn(
        "rounded-2xl",
        "border border-foreground/[0.08]",
        "bg-background/60 backdrop-blur-md",
        "overflow-hidden",
        "shadow-lg",
        "h-full"
      )}
    >
      <TileHeader
        label={item.label}
        subtitle={item.subtitle}
        icon={item.icon}
        count={item.count}
        onBack={onBack}
      />
      <motion.div
        variants={childrenContainerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="p-3"
        style={{ height: childrenHeight + EXPANDED_CONTENT_PADDING * 2 }}
      >
        <TileGrid
          items={children}
          onTileClick={onChildClick}
          selectedIndex={-1}
          availableWidth={availableWidth - EXPANDED_CONTENT_PADDING * 2}
          padding={{ top: 0, right: 0, bottom: 0, left: 0 }}
        />
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ExpandableTileGrid<T extends BaseTileItem>({
  items,
  expandedId,
  expandedChildren,
  onTileClick,
  onExpandedChildClick,
  onBack,
  availableWidth,
  selectedIndex = -1,
  gap = DEFAULT_GAP,
  padding = DEFAULT_PADDING,
  extraExpandedHeight = 0,
  renderExpandedContent,
}: ExpandableTileGridProps<T>) {
  // Compute the ORIGINAL layout (without expansion) - used for bucket sizing
  const originalLayout = useMemo(() => {
    return calculateMosaicLayout(items, {
      availableWidth,
      gap,
      padding,
    });
  }, [items, availableWidth, gap, padding]);

  // Convert items to LayoutItems for the layout algorithm
  const layoutItems: LayoutItem[] = useMemo(
    () => items.map((item) => ({ id: item.id, count: item.count })),
    [items]
  );

  // Convert children to LayoutItems
  const childLayoutItems: LayoutItem[] = useMemo(
    () => expandedChildren.map((c) => ({ id: c.id, count: c.count })),
    [expandedChildren]
  );

  // Use the pure layout algorithm for all position calculations
  const layoutResult = useMemo(() => {
    return calculateExpandedLayout({
      items: layoutItems,
      expandedId,
      children: childLayoutItems,
      config: {
        availableWidth,
        gap,
        padding,
      },
      extraExpandedHeight,
    });
  }, [layoutItems, expandedId, childLayoutItems, availableWidth, gap, padding, extraExpandedHeight]);

  // Extract positions and heights from the layout result
  const positions = layoutResult.positions;
  const totalHeight = layoutResult.totalHeight;

  // Build index map for selection (sorted by position)
  const itemIndexMap = useMemo(() => {
    const indexMap = new Map<string, number>();
    const sortedByPosition = [...items].sort((a, b) => {
      const posA = positions.get(a.id);
      const posB = positions.get(b.id);
      const yDiff = (posA?.y ?? 0) - (posB?.y ?? 0);
      if (Math.abs(yDiff) > 10) return yDiff;
      return (posA?.x ?? 0) - (posB?.x ?? 0);
    });
    sortedByPosition.forEach((item, index) => indexMap.set(item.id, index));
    return indexMap;
  }, [items, positions]);

  // Find the expanded item
  const expandedItem = useMemo(
    () => items.find((item) => item.id === expandedId) || null,
    [items, expandedId]
  );

  return (
    <div className="relative" style={{ height: totalHeight, minHeight: 200 }}>
      <AnimatePresence mode="popLayout">
        {items.map((item, animIndex) => {
          const pos = positions.get(item.id);
          const originalLayoutItem = originalLayout.tiles.get(item.id);
          if (!pos || !originalLayoutItem) return null;

          const globalIndex = itemIndexMap.get(item.id) ?? animIndex;
          const isExpanded = item.id === expandedId;
          const isSelected = globalIndex === selectedIndex;

          if (isExpanded && expandedItem) {
            return (
              <motion.div
                key={item.id}
                className="absolute"
                style={{ left: pos.x, width: pos.width, height: pos.height }}
                initial={{ top: pos.y, opacity: 0.9 }}
                animate={{ top: pos.y, opacity: 1 }}
                exit={{ opacity: 0.9 }}
                transition={{ duration: DURATIONS.expand, ease: crispEase }}
              >
                {renderExpandedContent ? (
                  renderExpandedContent(
                    item,
                    expandedChildren,
                    layoutResult.childrenHeight,
                    availableWidth
                  )
                ) : (
                  <DefaultExpandedContent
                    item={item}
                    children={expandedChildren}
                    childrenHeight={layoutResult.childrenHeight}
                    availableWidth={availableWidth}
                    onBack={onBack}
                    onChildClick={onExpandedChildClick}
                  />
                )}
              </motion.div>
            );
          }

          return (
            <motion.div
              key={item.id}
              className="absolute"
              style={{
                left: pos.x,
                width: pos.width,
                height: pos.height,
              }}
              initial={{ top: originalLayoutItem.y, opacity: 0, scale: 0.9 }}
              animate={{ top: pos.y, opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                duration: DURATIONS.standard,
                ease: crispEase,
                delay: Math.min(animIndex * 0.02, 0.15),
              }}
            >
              <Tile
                id={item.id}
                label={item.label}
                subtitle={item.subtitle}
                icon={item.icon}
                count={item.count}
                severityCounts={item.severityCounts}
                bucket={originalLayoutItem.bucket}
                isSelected={isSelected}
                onClick={() => onTileClick(item)}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/**
 * ExpandableTileGrid - Mosaic grid where tiles expand in-place
 *
 * When a tile is clicked:
 * - The tile expands IN PLACE to show its children inside it
 * - The expanded tile takes full width at its original row position
 * - Tiles that were beside it reflow below (since it now takes full width)
 * - Tiles that were already below also move down to accommodate
 *
 * Layout strategy:
 * 1. Calculate children layout to determine expanded tile's new height
 * 2. Calculate the Y position where the expanded tile starts
 * 3. Layout siblings that were ABOVE the expanded tile normally
 * 4. Place the expanded tile at its original Y (full width)
 * 5. Layout siblings that were AT OR BELOW the expanded tile's original Y,
 *    but now starting below the expanded tile
 */
import React, { useCallback, useMemo, useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
import { useComposedStore, getPluginServices } from "../../../core/store";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import type { TileItem } from "../../../core/plugin-system/types";
import { Tile } from "./Tile";
import { TileGrid } from "./TileGrid";
import { ExpandedTileHeader } from "./ExpandedTileHeader";
import { calculateMosaicLayout, calculateChildGridLayout } from "./layout";
import {
  childrenContainerVariants,
  crispEase,
  DURATIONS,
} from "./animations/expansion-animations";

// ============================================================================
// Types
// ============================================================================

interface ExpandableTileGridProps {
  /** Root-level tile items */
  items: TileItem[];
  /** Currently selected index for keyboard navigation */
  selectedIndex: number;
  /** Callback when a tile is clicked (at any level) */
  onTileClick?: (item: TileItem, level: number) => void;
  /** Whether we're in a terminal state (no more expansion possible) */
  isTerminal?: boolean;
}

// ============================================================================
// Layout Constants
// ============================================================================

const GRID_PADDING = { top: 20, right: 24, bottom: 20, left: 24 };
const GRID_AVAILABLE_WIDTH = 532;
const GRID_GAP = 14;
const EXPANDED_HEADER_HEIGHT = 52;
const EXPANDED_PADDING = 12;

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to manage expansion state and actions
 */
function useExpansion(items: TileItem[]) {
  const expansionPath = useComposedStore((s) => s.commandPalette.expansionPath);
  const expandTile = useComposedStore((s) => s.expandTile);
  const collapseTile = useComposedStore((s) => s.collapseTile);
  const closeCommandPalette = useComposedStore((s) => s.closeCommandPalette);
  const openInspectorPanel = useComposedStore((s) => s.openInspectorPanel);

  const currentLevel = expansionPath.length;
  const currentExpansion = expansionPath[currentLevel - 1] || null;
  const expandedTileId = currentExpansion?.item.id || null;

  const handleTileClick = useCallback(
    (item: TileItem) => {
      const services = getPluginServices();
      if (!services) return;

      // Toggle: clicking expanded tile collapses it
      if (item.id === expandedTileId) {
        collapseTile();
        return;
      }

      // Execute commands
      const execute = item.metadata?.execute as ((services: unknown) => Promise<void>) | undefined;
      if (execute) {
        execute(services);
        closeCommandPalette();
        return;
      }

      // Get provider
      const providerId = item.metadata?.providerId as string | undefined;
      if (!providerId) {
        openInspectorPanel();
        closeCommandPalette();
        return;
      }

      const tileProviders = pluginRegistry.getAllTileProviders();
      const providerEntry = tileProviders.find((p) => p.pluginId === providerId);
      if (!providerEntry) {
        openInspectorPanel();
        closeCommandPalette();
        return;
      }

      const { provider } = providerEntry;
      const canExpand = provider.canExpand?.(item) ?? false;

      if (canExpand && currentLevel < 2) {
        const children = provider.getChildItems?.(item, services) ?? [];
        if (children.length > 0) {
          // Collapse current and expand new
          if (currentExpansion) {
            collapseTile();
            setTimeout(() => expandTile(item, children, items, providerId), 50);
          } else {
            expandTile(item, children, items, providerId);
          }
          return;
        }
      }

      // Terminal
      openInspectorPanel();
      closeCommandPalette();
    },
    [currentLevel, currentExpansion, expandedTileId, expandTile, collapseTile, closeCommandPalette, openInspectorPanel, items]
  );

  const handleBack = useCallback(() => {
    if (currentLevel > 0) collapseTile();
  }, [currentLevel, collapseTile]);

  return { currentExpansion, expandedTileId, handleTileClick, handleBack };
}

// ============================================================================
// Sub-components
// ============================================================================

function ExpandedTileInline({
  item,
  children,
  onBack,
  onChildClick,
}: {
  item: TileItem;
  children: TileItem[];
  onBack: () => void;
  onChildClick: (item: TileItem) => void;
}) {
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
        "shadow-lg"
      )}
    >
      <ExpandedTileHeader item={item} onBack={onBack} level={0} />
      <motion.div
        variants={childrenContainerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="p-3"
      >
        <TileGrid
          items={children}
          onTileClick={onChildClick}
          selectedIndex={-1}
          isTerminal={true}
        />
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ExpandableTileGrid({
  items,
  selectedIndex,
  onTileClick,
  isTerminal = false,
}: ExpandableTileGridProps) {
  const { currentExpansion, expandedTileId, handleTileClick, handleBack } = useExpansion(items);

  // Measure actual expanded content height
  const expandedContentRef = useRef<HTMLDivElement>(null);
  const [measuredExpandedHeight, setMeasuredExpandedHeight] = useState(0);

  useEffect(() => {
    if (expandedContentRef.current && expandedTileId) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setMeasuredExpandedHeight(entry.contentRect.height);
        }
      });
      observer.observe(expandedContentRef.current);
      return () => observer.disconnect();
    } else {
      setMeasuredExpandedHeight(0);
    }
  }, [expandedTileId]);

  // First, compute the ORIGINAL layout (without expansion)
  const originalLayout = useMemo(() => {
    return calculateMosaicLayout(items, {
      availableWidth: GRID_AVAILABLE_WIDTH,
      gap: GRID_GAP,
      padding: GRID_PADDING,
    });
  }, [items]);

  // Get the expanded tile's original position
  const expandedTileOriginalLayout = expandedTileId
    ? originalLayout.tiles.get(expandedTileId)
    : null;

  // Estimate expanded height from children
  const estimatedExpandedHeight = useMemo(() => {
    if (!currentExpansion?.children.length) return 0;
    const childItems = currentExpansion.children.map((c) => ({ id: c.id, count: c.count }));
    const childLayout = calculateChildGridLayout(childItems, {
      availableWidth: GRID_AVAILABLE_WIDTH - EXPANDED_PADDING * 2 - 24,
      columns: 2,
      gap: 10,
      tileHeight: 80,
    });
    return EXPANDED_HEADER_HEIGHT + childLayout.totalHeight + EXPANDED_PADDING * 2 + 24;
  }, [currentExpansion?.children]);

  const effectiveExpandedHeight = measuredExpandedHeight || estimatedExpandedHeight;

  // Compute final positions for all tiles
  const { positions, totalHeight } = useMemo(() => {
    if (!expandedTileId || !expandedTileOriginalLayout) {
      // No expansion - use original layout directly
      const posMap = new Map<string, { x: number; y: number; width: number; height: number }>();
      for (const item of items) {
        const layout = originalLayout.tiles.get(item.id);
        if (layout) {
          posMap.set(item.id, {
            x: layout.x,
            y: layout.y,
            width: parseFloat(layout.width),
            height: layout.height,
          });
        }
      }
      return { positions: posMap, totalHeight: originalLayout.totalHeight };
    }

    // With expansion: recalculate positions
    const posMap = new Map<string, { x: number; y: number; width: number; height: number }>();

    // The Y threshold: tiles at or below this Y need to be reflowed
    const expandedOriginalY = expandedTileOriginalLayout.y;
    const expandedOriginalHeight = expandedTileOriginalLayout.height;

    // Separate tiles into: above expanded, and at/below expanded (excluding the expanded tile itself)
    const tilesAbove: TileItem[] = [];
    const tilesAtOrBelow: TileItem[] = [];

    for (const item of items) {
      if (item.id === expandedTileId) continue;
      const layout = originalLayout.tiles.get(item.id);
      if (!layout) continue;

      // A tile is "above" if its bottom edge is above the expanded tile's top edge
      const tileBottom = layout.y + layout.height;
      if (tileBottom <= expandedOriginalY) {
        tilesAbove.push(item);
      } else {
        tilesAtOrBelow.push(item);
      }
    }

    // Tiles above keep their original positions
    for (const item of tilesAbove) {
      const layout = originalLayout.tiles.get(item.id)!;
      posMap.set(item.id, {
        x: layout.x,
        y: layout.y,
        width: parseFloat(layout.width),
        height: layout.height,
      });
    }

    // Expanded tile: full width, at its original Y
    posMap.set(expandedTileId, {
      x: GRID_PADDING.left,
      y: expandedOriginalY,
      width: GRID_AVAILABLE_WIDTH,
      height: effectiveExpandedHeight,
    });

    // Layout tiles that were at or below the expanded tile
    // They now start below the expanded tile
    const belowStartY = expandedOriginalY + effectiveExpandedHeight + GRID_GAP;

    if (tilesAtOrBelow.length > 0) {
      // Re-layout these tiles using mosaic algorithm
      const belowLayout = calculateMosaicLayout(tilesAtOrBelow, {
        availableWidth: GRID_AVAILABLE_WIDTH,
        gap: GRID_GAP,
        padding: { top: 0, right: 0, bottom: GRID_PADDING.bottom, left: 0 },
      });

      for (const item of tilesAtOrBelow) {
        const layout = belowLayout.tiles.get(item.id);
        if (layout) {
          posMap.set(item.id, {
            x: layout.x + GRID_PADDING.left,
            y: layout.y + belowStartY,
            width: parseFloat(layout.width),
            height: layout.height,
          });
        }
      }

      const newTotalHeight = belowStartY + belowLayout.totalHeight;
      return { positions: posMap, totalHeight: newTotalHeight };
    }

    // No tiles below
    const newTotalHeight = belowStartY;
    return { positions: posMap, totalHeight: newTotalHeight };
  }, [items, expandedTileId, expandedTileOriginalLayout, originalLayout, effectiveExpandedHeight]);

  // Build index map for selection
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

  const onTileClickInternal = useCallback(
    (item: TileItem) => {
      handleTileClick(item);
      onTileClick?.(item, 0);
    },
    [handleTileClick, onTileClick]
  );

  const onChildClick = useCallback(
    (item: TileItem) => {
      const openInspectorPanel = useComposedStore.getState().openInspectorPanel;
      const closeCommandPalette = useComposedStore.getState().closeCommandPalette;
      openInspectorPanel();
      closeCommandPalette();
      onTileClick?.(item, 1);
    },
    [onTileClick]
  );

  return (
    <div className="relative" style={{ height: totalHeight, minHeight: 200 }}>
      <AnimatePresence mode="popLayout">
        {items.map((item, animIndex) => {
          const pos = positions.get(item.id);
          const originalLayoutItem = originalLayout.tiles.get(item.id);
          if (!pos || !originalLayoutItem) return null;

          const globalIndex = itemIndexMap.get(item.id) ?? animIndex;
          const isExpanded = item.id === expandedTileId;
          const isSelected = globalIndex === selectedIndex;

          if (isExpanded && currentExpansion) {
            return (
              <motion.div
                key={item.id}
                ref={expandedContentRef}
                className="absolute"
                style={{ left: pos.x, width: pos.width }}
                initial={{ top: pos.y, opacity: 0.9 }}
                animate={{ top: pos.y, opacity: 1 }}
                exit={{ opacity: 0.9 }}
                transition={{ duration: DURATIONS.expand, ease: crispEase }}
              >
                <ExpandedTileInline
                  item={item}
                  children={currentExpansion.children}
                  onBack={handleBack}
                  onChildClick={onChildClick}
                />
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
                item={item}
                bucket={originalLayoutItem.bucket}
                isSelected={isSelected}
                onClick={() => onTileClickInternal(item)}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export type { ExpandableTileGridProps };

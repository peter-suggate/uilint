/**
 * ExpandableTileGrid - Mosaic grid where tiles expand in-place
 *
 * When a tile is clicked:
 * - The tile expands to show its children inside it
 * - Other tiles (siblings) remain visible in their normal mosaic positions
 * - The layout adjusts to accommodate the expanded tile
 *
 * This preserves the mosaic arrangement while allowing drill-down navigation.
 */
import React, { useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
import { useComposedStore, getPluginServices } from "../../../core/store";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import type { TileItem, TileBucket } from "../../../core/plugin-system/types";
import { Tile } from "./Tile";
import { TileGrid } from "./TileGrid";
import { ExpandedTileHeader } from "./ExpandedTileHeader";
import { calculateMosaicLayout } from "./layout";
import {
  expansionWrapperVariants,
  expansionWrapperTransition,
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

  // Get the expanded tile ID at the current level
  const expandedTileId = currentExpansion?.item.id || null;

  /**
   * Handle tile click - expand if possible, or open inspector if terminal
   */
  const handleTileClick = useCallback(
    (item: TileItem) => {
      const services = getPluginServices();
      if (!services) return;

      // If clicking the already expanded tile, collapse it
      if (item.id === expandedTileId) {
        collapseTile();
        return;
      }

      // Check if item has an execute function (commands)
      const execute = item.metadata?.execute as ((services: unknown) => Promise<void>) | undefined;
      if (execute) {
        execute(services);
        closeCommandPalette();
        return;
      }

      // Get provider for this item
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

      // Check if tile can be expanded
      const canExpand = provider.canExpand?.(item) ?? false;

      if (canExpand && currentLevel < 2) {
        // Get children for this tile
        const children = provider.getChildItems?.(item, services) ?? [];

        if (children.length > 0) {
          // If there's already an expansion at this level, collapse first
          if (currentExpansion) {
            collapseTile();
            // Small delay then expand the new one
            setTimeout(() => {
              expandTile(item, children, items, providerId);
            }, 50);
          } else {
            expandTile(item, children, items, providerId);
          }
          return;
        }
      }

      // Terminal: open inspector and close
      openInspectorPanel();
      closeCommandPalette();
    },
    [currentLevel, currentExpansion, expandedTileId, expandTile, collapseTile, closeCommandPalette, openInspectorPanel, items]
  );

  /**
   * Handle back/collapse action
   */
  const handleBack = useCallback(() => {
    if (currentLevel > 0) {
      collapseTile();
    }
  }, [currentLevel, collapseTile]);

  return {
    expansionPath,
    currentLevel,
    currentExpansion,
    expandedTileId,
    handleTileClick,
    handleBack,
  };
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Expanded tile showing children inside
 */
function ExpandedTileInline({
  item,
  children,
  bucket,
  onBack,
  onChildClick,
  selectedIndex,
}: {
  item: TileItem;
  children: TileItem[];
  bucket: TileBucket;
  onBack: () => void;
  onChildClick: (item: TileItem) => void;
  selectedIndex: number;
}) {
  return (
    <motion.div
      layout
      layoutId={`tile-${item.id}`}
      initial={{ opacity: 0.8 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0.8 }}
      transition={{ duration: DURATIONS.expand, ease: crispEase }}
      className={cn(
        "rounded-2xl",
        "border border-foreground/[0.08]",
        "bg-background/60 backdrop-blur-md",
        "overflow-hidden",
        "shadow-lg"
      )}
    >
      {/* Header with back button */}
      <ExpandedTileHeader
        item={item}
        onBack={onBack}
        level={0}
      />

      {/* Children grid */}
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
          selectedIndex={selectedIndex}
          isTerminal={true}
        />
      </motion.div>
    </motion.div>
  );
}

/**
 * Normal tile (not expanded)
 */
function NormalTile({
  item,
  bucket,
  isSelected,
  onClick,
  isExpanded,
}: {
  item: TileItem;
  bucket: TileBucket;
  isSelected: boolean;
  onClick: () => void;
  isExpanded: boolean;
}) {
  return (
    <motion.div
      layout
      layoutId={`tile-${item.id}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: DURATIONS.standard, ease: crispEase }}
    >
      <Tile
        item={item}
        bucket={bucket}
        isSelected={isSelected}
        onClick={onClick}
      />
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
  const {
    currentExpansion,
    expandedTileId,
    handleTileClick,
    handleBack,
  } = useExpansion(items);

  // Calculate layout for all items
  const { layout, sortedItems, itemIndexMap } = useMemo(() => {
    const computedLayout = calculateMosaicLayout(items, {
      availableWidth: GRID_AVAILABLE_WIDTH,
      gap: GRID_GAP,
      padding: GRID_PADDING,
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

  /**
   * Handle tile click
   */
  const onTileClickInternal = useCallback(
    (item: TileItem) => {
      handleTileClick(item);
      onTileClick?.(item, 0);
    },
    [handleTileClick, onTileClick]
  );

  /**
   * Handle child tile click (within expanded tile)
   */
  const onChildClick = useCallback(
    (item: TileItem) => {
      // For now, child clicks go to inspector (terminal)
      const services = getPluginServices();
      if (!services) return;

      const openInspectorPanel = useComposedStore.getState().openInspectorPanel;
      const closeCommandPalette = useComposedStore.getState().closeCommandPalette;

      openInspectorPanel();
      closeCommandPalette();

      onTileClick?.(item, 1);
    },
    [onTileClick]
  );

  // Calculate expanded tile's new height (for layout adjustment)
  const expandedHeight = currentExpansion
    ? Math.min(300, 80 + currentExpansion.children.length * 40) // Rough estimate
    : 0;

  // Find expanded tile's layout position
  const expandedTileLayout = expandedTileId ? layout.tiles.get(expandedTileId) : null;

  return (
    <div
      className="relative"
      style={{
        height: expandedTileId
          ? layout.totalHeight + expandedHeight
          : layout.totalHeight,
        minHeight: 200,
      }}
    >
      <AnimatePresence mode="popLayout">
        {sortedItems.map((item, animIndex) => {
          const tileLayout = layout.tiles.get(item.id);
          if (!tileLayout) return null;

          const globalIndex = itemIndexMap.get(item.id) ?? animIndex;
          const isExpanded = item.id === expandedTileId;
          const isSelected = globalIndex === selectedIndex;

          // Calculate position offset for tiles below expanded tile
          let yOffset = 0;
          if (expandedTileId && expandedTileLayout && !isExpanded) {
            // If this tile is below the expanded tile, push it down
            if (tileLayout.y > expandedTileLayout.y) {
              yOffset = expandedHeight;
            }
          }

          if (isExpanded && currentExpansion) {
            // Render expanded tile
            return (
              <motion.div
                key={item.id}
                className="absolute"
                style={{
                  left: GRID_PADDING.left,
                  top: tileLayout.y,
                  width: GRID_AVAILABLE_WIDTH,
                }}
                initial={{ height: tileLayout.height }}
                animate={{ height: "auto" }}
                transition={{ duration: DURATIONS.expand, ease: crispEase }}
              >
                <ExpandedTileInline
                  item={item}
                  children={currentExpansion.children}
                  bucket={tileLayout.bucket}
                  onBack={handleBack}
                  onChildClick={onChildClick}
                  selectedIndex={-1}
                />
              </motion.div>
            );
          }

          // Render normal tile
          return (
            <motion.div
              key={item.id}
              className="absolute"
              style={{
                left: tileLayout.x,
                width: tileLayout.width,
                height: tileLayout.height,
              }}
              initial={{ top: tileLayout.y, opacity: 0, scale: 0.9 }}
              animate={{
                top: tileLayout.y + yOffset,
                opacity: 1,
                scale: 1,
              }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                duration: DURATIONS.standard,
                ease: crispEase,
                delay: Math.min(animIndex * 0.03, 0.2),
              }}
            >
              <Tile
                item={item}
                bucket={tileLayout.bucket}
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

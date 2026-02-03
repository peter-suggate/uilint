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
import React, { useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
import { useComposedStore, getPluginServices } from "../../../core/store";
import { pluginRegistry } from "../../../core/plugin-system/registry";
import type { TileItem } from "../../../core/plugin-system/types";
import { Tile } from "./Tile";
import { TileGrid } from "./TileGrid";
import { ExpandedTileHeader } from "./ExpandedTileHeader";
import { calculateMosaicLayout, calculateExpandedLayout } from "./layout";
import type { LayoutItem } from "./layout";
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
  height,
  childrenHeight,
  onBack,
  onChildClick,
}: {
  item: TileItem;
  children: TileItem[];
  /** Total height of the expanded tile (from layout algorithm) */
  height: number;
  /** Height of the children grid area (from layout algorithm) */
  childrenHeight: number;
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
      style={{ height }}
    >
      <ExpandedTileHeader item={item} onBack={onBack} level={0} />
      <motion.div
        variants={childrenContainerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="p-3"
        style={{ height: childrenHeight + EXPANDED_PADDING * 2 }}
      >
        <TileGrid
          items={children}
          onTileClick={onChildClick}
          selectedIndex={-1}
          isTerminal={true}
          availableWidth={GRID_AVAILABLE_WIDTH - EXPANDED_PADDING * 2}
          padding={{ top: 0, right: 0, bottom: 0, left: 0 }}
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
  const openInspectorPanelAction = useComposedStore((s) => s.openInspectorPanel);
  const closeCommandPaletteAction = useComposedStore((s) => s.closeCommandPalette);

  // First, compute the ORIGINAL layout (without expansion) - used for bucket sizing
  const originalLayout = useMemo(() => {
    return calculateMosaicLayout(items, {
      availableWidth: GRID_AVAILABLE_WIDTH,
      gap: GRID_GAP,
      padding: GRID_PADDING,
    });
  }, [items]);

  // Convert TileItems to LayoutItems for the layout algorithm
  const layoutItems: LayoutItem[] = useMemo(
    () => items.map((item) => ({ id: item.id, count: item.count })),
    [items]
  );

  // Convert children to LayoutItems
  const childLayoutItems: LayoutItem[] = useMemo(
    () => (currentExpansion?.children ?? []).map((c) => ({ id: c.id, count: c.count })),
    [currentExpansion?.children]
  );

  // Use the pure layout algorithm for all position calculations
  const layoutResult = useMemo(() => {
    return calculateExpandedLayout({
      items: layoutItems,
      expandedId: expandedTileId,
      children: childLayoutItems,
      config: {
        availableWidth: GRID_AVAILABLE_WIDTH,
        gap: GRID_GAP,
        padding: GRID_PADDING,
      },
    });
  }, [layoutItems, expandedTileId, childLayoutItems]);

  // Extract positions and heights from the layout result
  const positions = layoutResult.positions;
  const totalHeight = layoutResult.totalHeight;

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
      openInspectorPanelAction();
      closeCommandPaletteAction();
      onTileClick?.(item, 1);
    },
    [openInspectorPanelAction, closeCommandPaletteAction, onTileClick]
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
                className="absolute"
                style={{ left: pos.x, width: pos.width, height: pos.height }}
                initial={{ top: pos.y, opacity: 0.9 }}
                animate={{ top: pos.y, opacity: 1 }}
                exit={{ opacity: 0.9 }}
                transition={{ duration: DURATIONS.expand, ease: crispEase }}
              >
                <ExpandedTileInline
                  item={item}
                  children={currentExpansion.children}
                  height={pos.height}
                  childrenHeight={layoutResult.childrenHeight}
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
